/**
 * This file is part of the 'Symfony Helper'
 * Copyright (c) 2019 Timur Morduhai
 * Licensed under the GNU General Public License
 */
import * as path from 'path';

import {
    CompletionParams,
    CompletionList,
    TextDocumentPositionParams,
    Definition,
    Range,
    Position,
    TextDocument,
    FoldingRangeParams,
    FoldingRange,
    Hover,
    IConnection,
    WorkspaceFolder,
    ReferenceParams,
    Location,
    SignatureHelp,
} from 'vscode-languageserver';

import { FoldingRangeKind } from 'vscode-languageserver-protocol/lib/protocol.foldingRange';

import URI from 'vscode-uri';

import {
    tokenize as tokenizeTwig,
    findTwigPieces,
    parse as twigParse,
    Statement as TwigStatement,
    typesOfSimplestStatementWithStatements,
    SimplestStatementWithStatements,
} from './twig';

import * as nikic from './nikic-php-parser';

import {
    fileExists,
    readFile,
    writeFile,
    createDirectory,
    exec,
    AllTextDocuments,
    packagePath,
    requestHttpCommandsHelper,
    SymfonyHelperSettings
} from './utils';

import { Project } from './project';

export class Service {
    private allDocuments: AllTextDocuments;

    /**
     * Data for every workspace folder
     *
     * 'folderUri' have form 'file:///c%3A/...' on windows
     *
     * Folders should not contain each other and should all be different and should not end with '/'
     */
    private projects: { [folderUri: string]: Project } = Object.create(null);

    private connection: IConnection | undefined;

    private isScanning = false;

    private getSettings?: (uri: string) => Promise<SymfonyHelperSettings|null>;

    constructor(allDocuments: AllTextDocuments) {
        this.allDocuments = allDocuments;
    }

    public setConnection(connection: IConnection | undefined) {
        this.connection = connection;
    }

    public async setProjects(folders: WorkspaceFolder[]) {
        let filteredFolders: WorkspaceFolder[] = [];
        for (let folder of folders) {
            let composerJsonPath = URI.parse(folder.uri + '/composer.json').fsPath;
            if (await fileExists(composerJsonPath)) {
                filteredFolders.push(folder);
            }
        }

        // delete deleted projects
        let filteredFoldersUris = filteredFolders.map(row => row.uri);
        let deleteUris = [];
        for (let folderUri in this.projects) {
            if (!filteredFoldersUris.includes(folderUri)) {
                deleteUris.push(folderUri);
            }
        }
        for (let uri of deleteUris) {
            delete this.projects[uri];
        }

        let newProjects = [];

        for (let folder of filteredFolders) {
            let folderUri = folder.uri;

            if (this.projects[folderUri] !== undefined) {
                continue;
            }

            let project = new Project(folder.name, folderUri, this.allDocuments);

            if (this.getSettings !== undefined) {
                project.setSettingsResolver(this.getSettings);
            }

            newProjects.push(project);
            this.projects[folderUri] = project;
        }

        await this.scanProjects(newProjects);
    }

    private async scanProjects(projects: Project[]) {
        if (this.isScanning) {
            return;
        }

        if (projects.length > 0) {
            this.isScanning = true;

            for (let p of projects) {
                try {
                    if (this.connection !== undefined) {
                        this.connection.sendRequest('statusBarMessage', { message: `indexing '${p.getName()}' ...` });
                    }
                    await p.scan();
                } catch {
                    console.log(`service.ts: failed scanning of project '${p.getName()}'`);
                }
            }
            this.isScanning = false;

            if (this.connection !== undefined) {
                this.connection.sendRequest('statusBarMessage', { message: 'projects indexed' });
            }
        }
    }

    public async onCompletition(params: CompletionParams): Promise<CompletionList> {
        let result: CompletionList = {
            items: [],
            isIncomplete: true,
        };

        let documentUri = params.textDocument.uri;

        let project = this.findFileProject(documentUri);

        if (project === null) {
            return result;
        }

        result.items = await project.onCompletition(params);

        return result;
    }

    public async onDefinition(params: TextDocumentPositionParams): Promise<Definition | null> {
        let documentUri = params.textDocument.uri;

        let project = this.findFileProject(documentUri);

        if (project === null) {
            return null;
        }

        return await project.onDefinition(params);
    }

    public async onReferences(params: ReferenceParams): Promise<Location[]> {
        let documentUri = params.textDocument.uri;

        let project = this.findFileProject(documentUri);

        if (project === null) {
            return [];
        }

        return project.onReferences(params);
    }

    public async onFoldingRanges(params: FoldingRangeParams): Promise<FoldingRange[]> {
        let ranges: FoldingRange[] = [];

        if (!params.textDocument.uri.endsWith('.twig')) {
            return ranges;
        }

        let document = await this.getDocument(params.textDocument.uri);
        if (document === null) {
            return ranges;
        }

        let code = document.getText();
        let tokens = tokenizeTwig(code);
        let pieces = findTwigPieces(tokens);
        let twigStatements = twigParse(code, tokens, pieces);

        for (let piece of pieces) {
            if (piece.type === 'comment') {
                let startLine = document.positionAt(piece.start).line;
                let endLine = document.positionAt(piece.end).line;
                if (endLine > startLine + 1) {
                    ranges.push({
                        startLine,
                        endLine: endLine - 1,
                        kind: FoldingRangeKind.Comment,
                    });
                }
                continue;
            }
        }

        let addFoldBetweenPieces = (pieceIndex: number, pieceIndex2: number, doc: TextDocument) => {
            let startLine = doc.positionAt(pieces[pieceIndex].start).line;
            let endLine = doc.positionAt(pieces[pieceIndex2].start).line;
            if (endLine > startLine + 1) {
                ranges.push({
                    startLine,
                    endLine: endLine - 1,
                });
            }
        };

        let walker = (stmts: TwigStatement[], doc: TextDocument) => {
            for (let stmt of stmts) {
                if (stmt.type === 'if') {
                    let pieceIndexes: number[] = [stmt.startPiece];

                    if (stmt.elseIfParts !== undefined) {
                        for (let part of stmt.elseIfParts) {
                            pieceIndexes.push(part.pieceIndex);
                        }
                    }

                    if (stmt.elsePart !== undefined) {
                        pieceIndexes.push(stmt.elsePart.pieceIndex);
                    }

                    if (stmt.endPiece !== undefined) {
                        pieceIndexes.push(stmt.endPiece);
                    }

                    for (let i = 0; i < pieceIndexes.length - 1; i++) {
                        addFoldBetweenPieces(pieceIndexes[i], pieceIndexes[i+1], doc);
                    }

                    walker(stmt.stmts, doc);
                    if (stmt.elseIfParts !== undefined) {
                        for (let part of stmt.elseIfParts) {
                            walker(part.stmts, doc);
                        }
                    }
                    if (stmt.elsePart !== undefined) {
                        walker(stmt.elsePart.stmts, doc);
                    }

                } else if (stmt.type === 'for') {
                    if (stmt.elsePart === undefined) {
                        if (stmt.endPiece  !== undefined) {
                            addFoldBetweenPieces(stmt.startPiece, stmt.endPiece, doc);
                        }
                    } else {
                        addFoldBetweenPieces(stmt.startPiece, stmt.elsePart.pieceIndex, doc);
                        if (stmt.endPiece !== undefined) {
                            addFoldBetweenPieces(stmt.elsePart.pieceIndex, stmt.endPiece, doc);
                        }
                    }

                    walker(stmt.stmts, doc);
                    if (stmt.elsePart !== undefined) {
                        walker(stmt.elsePart.stmts, doc);
                    }

                } else if (typesOfSimplestStatementWithStatements.includes(stmt.type)) {
                    let stmt2 = stmt as SimplestStatementWithStatements;

                    if (stmt2.endPiece !== undefined) {
                        addFoldBetweenPieces(stmt2.startPiece, stmt2.endPiece, doc);
                    }

                    walker(stmt2.stmts, doc);
                }
            }
        };

        walker(twigStatements, document);

        return ranges;
    }

    public async onHover(params: TextDocumentPositionParams): Promise<Hover | null> {
        let documentUri = params.textDocument.uri;

        let project = this.findFileProject(documentUri);

        if (project === null) {
            return null;
        }

        return await project.onHover(params);
    }

    public async onSignatureHelp(params: TextDocumentPositionParams): Promise<SignatureHelp | null> {
        let documentUri = params.textDocument.uri;

        let project = this.findFileProject(documentUri);

        if (project === null) {
            return null;
        }

        return await project.onSignatureHelp(params);
    }

    public findFileProject(fileUri: string): Project | null {
        for (let folderUri in this.projects) {
            if (fileUri.startsWith(folderUri + '/')) {
                return this.projects[folderUri];
            }
        }

        return null;
    }

    private async getDocument(uri: string): Promise<TextDocument | null> {
        return this.allDocuments.get(uri);
    }

    public commandRebuildIndexes(): { success: true } | { success: false; message: string } {
        if (this.isScanning) {
            return { success: false, message: 'Indexing already running' };
        }

        nikic.cleanPhpParserHttpError();

        let projects = [];
        for (let folderUri in this.projects) {
            projects.push(this.projects[folderUri]);
        }

        this.scanProjects(projects)
            .then(() => {})
            .catch(() => {});

        return { success: true };
    }

    public async commandExtendTemplate(params: any): Promise<{ success: boolean; message: string; blocks?: { name: string; detail: string }[] }> {
        let baseTemplateUri: string = params.baseTemplateUri;
        let newTemplateRelativePath: string = params.newTemplateRelativePath;

        let project = this.findFileProject(baseTemplateUri);

        if (project === null) {
            return { success: false, message: 'Could not find project' };
        }

        let projectUri = project.getFolderUri();

        let templateInfo = project.getTemplateFromUri(baseTemplateUri);
        if (templateInfo === null) {
            return { success: false, message: 'Could not recognize template' };
        }

        let templatesFolderPath = project.templatesFolderUri.substr(project.getFolderUri().length + 1);

        if (!newTemplateRelativePath.startsWith(templatesFolderPath)) {
            return { success: false, message: `New template must be in '${templatesFolderPath}' folder` };
        }

        let newTemplateUri = projectUri + '/' + newTemplateRelativePath;

        let newTemplatePath = URI.parse(newTemplateUri).fsPath;

        if (await fileExists(newTemplatePath)) {
            return { success: false, message: 'File already exists' };
        }

        let baseTemplateName = templateInfo.name;

        let projectPath = URI.parse(projectUri).fsPath;
        let configFilePath = projectPath + '/.symfony-helper.json';

        // save file layout to config if it exist in request

        if (params.selectedBlocks) {
            let config: any;

            if (await fileExists(configFilePath)) {
                let configText: string | undefined;
                try {
                    configText = await readFile(configFilePath);
                } catch {
                    return { success: false, message: "Could not read '.symfony-helper.json'" };
                }

                try {
                    config = JSON.parse(configText);
                } catch {
                    return { success: false, message: "Could not parse '.symfony-helper.json'" };
                }
            } else {
                config = Object.create(null);
            }

            if (!config.extendingTemplates) {
                config.extendingTemplates = Object.create(null);
            }

            let blocksData = project.collectAllTemplateBlocks(baseTemplateName);

            let selectedBlocks: string[] = params.selectedBlocks;
            let newFileLayout = [];
            for (let blockName of selectedBlocks) {
                let layout = 'lines';

                if (blocksData[blockName] !== undefined) {
                    let blockData = blocksData[blockName];
                    layout = blockData[blockData.length - 1].layout;
                }

                newFileLayout.push({
                    name: blockName,
                    layout,
                    parent: false,
                });
            }
            config.extendingTemplates[baseTemplateName] = newFileLayout;

            try {
                await writeFile(configFilePath, JSON.stringify(config, null, 4));
            } catch {
                return { success: false, message: "Could not write to '.symfony-helper.json'" };
            }
        }

        // read file layout from config

        // 'name' is block name
        // 'parent' is using parent()
        let fileLayout: { name: string; layout: 'short'|'one-line'|'lines'; parent: boolean }[] | undefined;

        if (await fileExists(configFilePath)) {
            let configText: string | undefined;
            try {
                configText = await readFile(configFilePath);
            } catch {
                return { success: false, message: "Could not read '.symfony-helper.json'" };
            }

            let config: any;
            try {
                config = JSON.parse(configText);
            } catch {
                return { success: false, message: "Could not parse '.symfony-helper.json'" };
            }

            if (config.extendingTemplates
                    && config.extendingTemplates[baseTemplateName]
                    && config.extendingTemplates[baseTemplateName].length /* array test */) {
                fileLayout = config.extendingTemplates[baseTemplateName];
            }
        }

        if (fileLayout === undefined) {
            if (params.selectedBlocks) {
                return { success: false, message: 'Could not save blocks' };
            } else {
                let data = project.collectAllTemplateBlocks(baseTemplateName);

                let blocks: { name: string; detail: string }[] = [];
                for (let blockName in data) {
                    let blockParentsData = data[blockName];

                    blocks.push({
                        name: blockName,
                        detail: 'from ' + blockParentsData.map(r => r.templateName).join(', '),
                    });
                }

                return { success: false, message: '', blocks };
            }
        }

        let newTemplateText: string;
        {
            let lineSep = '\n';
            let useFinalLineSep = true;
            let tab = '\t';

            let newTemplatePieces: string[] = [
                `{% extends '${baseTemplateName}' %}`
            ];

            for (let row of fileLayout) {
                let piece;

                if (row.layout === 'short') {
                    piece = `{% block ${row.name} ${row.parent ? 'parent()' : "''"} %}`;
                } else if (row.layout === 'one-line') {
                    piece = `{% block ${row.name} %}${row.parent ? '{{ parent() }}' : ''}{% endblock %}`;
                } else if (row.layout === 'lines') {
                    piece = `{% block ${row.name} %}${lineSep}${row.parent ? (tab + '{{ parent() }}' + lineSep) : ''}{% endblock %}`;
                }

                if (piece !== undefined) {
                    newTemplatePieces.push(piece);
                }
            }

            newTemplateText = newTemplatePieces.join(lineSep + lineSep) + (useFinalLineSep ? lineSep : '');
        }

        try {
            let newTemplateDir = path.dirname(newTemplatePath);
            if (!(await fileExists(newTemplateDir))) {
                await createDirectory(newTemplateDir);
            }
            await writeFile(newTemplatePath, newTemplateText);
        } catch {
            return { success: false, message: 'Could not write file' };
        }

        return { success: true, message: newTemplateUri };
    }

    public getNewTemplateFolder(params: any): { success: boolean; message: string } {
        let baseTemplateUri: string = params.baseTemplateUri;

        let project = this.findFileProject(baseTemplateUri);

        if (project === null) {
            return { success: false, message: 'Could not find project' };
        }

        let isBaseFromTemplatesFolder = baseTemplateUri.startsWith(project.templatesFolderUri + '/');

        let prefix;

        if (isBaseFromTemplatesFolder) {
            prefix = path.dirname(baseTemplateUri).substr(project.getFolderUri().length + 1) + '/';
        } else {
            prefix = project.templatesFolderUri.substr(project.getFolderUri().length + 1) + '/';
        }

        return { success: true, message: prefix };
    }

    public async commandOpenCompiledTemplate(params: any): Promise<{ success: boolean; message: string }> {
        let templateUri: string = params.uri;

        let project = this.findFileProject(templateUri);
        if (project === null) {
            return { success: false, message: 'Could not find project of template' };
        }

        if (!project.isSymfony()) {
            return { success: false, message: 'This command is only for symfony projects' };
        }

        let projectUri = project.getFolderUri();
        let projectFsPath = URI.parse(projectUri).fsPath;

        if (!templateUri.endsWith('.twig')) {
            return { success: false, message: 'This command is only for twig templates' };
        }

        let templateName = project.templateName(templateUri);
        if (templateName === null) {
            return { success: false, message: 'Could not find template name' };
        }

        let phpScriptPath = path.join(packagePath, 'php-bin/symfony-commands.php');

        if (this.getSettings === undefined) {
            return { success: false, message: 'Internal error' };
        }

        let responseRaw = '';
        try {
            let settings = await this.getSettings(projectUri);
            if (settings === null) {
                return { success: false, message: 'Internal error' };
            }

            if (settings.consoleHelper.type === 'direct') {
                responseRaw = await exec(settings.consoleHelper.phpPath, [phpScriptPath, projectFsPath, 'otherCommand', 'findCompiledTemplate ' + templateName]);
            } else if (settings.consoleHelper.type === 'http') {
                responseRaw = await requestHttpCommandsHelper(settings.consoleHelper.webPath, 'otherCommand', 'findCompiledTemplate ' + templateName);
            }
        } catch {
            return { success: false, message: 'Internal error' };
        }

        let response: any;
        try {
            response = JSON.parse(responseRaw);
        } catch {
            return { success: false, message: 'Internal error' };
        }

        if (response.result !== 'success') {
            if (response.result === 'internal-error' || !response.message) {
                return { success: false, message: 'Internal error' };
            } else {
                return { success: false, message: response.message };
            }
        }

        return { success: true, message: path.join(projectFsPath, response.message) };
    }

    public async commandToggleTwigComment(params: any): Promise<{ success: boolean; message: string }> {
        let templateUri: string = params.uri;
        let start = params.start as Position;
        let end = params.end as Position;

        let project = this.findFileProject(templateUri);
        if (project === null) {
            return { success: false, message: 'Could not find project of template' };
        }

        let document = await this.getDocument(templateUri);
        if (document === null) {
            return { success: false, message: 'Could not find template' };
        }

        let startOffset = document.offsetAt(start);

        let text = document.getText();
        let tokens = tokenizeTwig(text);
        let pieces = findTwigPieces(tokens);

        let commentUnderCursor;
        for (let p of pieces) {
            if (p.type === 'comment' && p.start <= startOffset && startOffset <= p.end) {
                commentUnderCursor = p;
            }
        }

        let edits: any = Object.create(null);

        if (commentUnderCursor !== undefined) {
            let deletions: Range[] = [];

            if (text.substr(commentUnderCursor.end - 3, 3) === ' #}') {
                deletions.push(Range.create(
                    document.positionAt(commentUnderCursor.end - 3),
                    document.positionAt(commentUnderCursor.end)
                ));
            } else {
                deletions.push(Range.create(
                    document.positionAt(commentUnderCursor.end - 2),
                    document.positionAt(commentUnderCursor.end)
                ));
            }

            if (text.substr(commentUnderCursor.start, 3) === '{# ') {
                deletions.push(Range.create(
                    document.positionAt(commentUnderCursor.start),
                    document.positionAt(commentUnderCursor.start + 3)
                ));
            } else {
                deletions.push(Range.create(
                    document.positionAt(commentUnderCursor.start),
                    document.positionAt(commentUnderCursor.start + 2)
                ));
            }

            edits.deletions = deletions;
        } else {
            let insertions: { position: Position; value: string }[] = [];

            insertions.push({
                position: start,
                value: '{# ',
            });

            insertions.push({
                position: end,
                value: ' #}',
            });

            edits.insertions = insertions;
        }

        return { success: true, message: JSON.stringify(edits) };
    }

    public documentChanged(action: 'deleted'|'createdOrChanged', documentUri: string) {
        let project = this.findFileProject(documentUri);

        if (project === null) {
            return;
        }

        project.documentChanged(action, documentUri);
    }

    public setSettingsResolver(resolver: (uri: string) => Promise<SymfonyHelperSettings|null>) {
        this.getSettings = resolver;

        for (let folderUri in this.projects) {
            this.projects[folderUri].setSettingsResolver(resolver);
        }
    }
}
