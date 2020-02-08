/**
 * This file is part of the 'Symfony Helper'
 * Copyright (c) 2019 Timur Morduhai
 * Licensed under the GNU General Public License
 */
import {
    createConnection,
    TextDocuments,
    DidChangeConfigurationNotification,
} from 'vscode-languageserver';

import { Service } from './service';
import { AllTextDocuments, SymfonyHelperSettings } from './utils';
import { stopParserProcess } from './nikic-php-parser';
import * as nikic from './nikic-php-parser';

let documents = new TextDocuments();

let service = new Service(AllTextDocuments.productionInstance(documents));

let connection = createConnection();

connection.onInitialize(() => {
    return {
        capabilities: {
            textDocumentSync: {
                openClose: true, // looks like this is required for 'TextDocuments'
                change: documents.syncKind,
            },
            completionProvider: {
                // '.' for dql,
                // '"' and "'" for completion in '$this->getParameter()'
                // ':' and '@' for twig
                triggerCharacters: ['.', '"', "'", ':', '@'],
            },
            definitionProvider: true,
            foldingRangeProvider: {
                documentSelector: [{ pattern: '**/*.twig' }],
            },
            hoverProvider: true,
            referencesProvider: true,
            signatureHelpProvider: {
                triggerCharacters: ['(', ',']
            },
        },
    };
});

async function tryRestartPhpParserProcess(params?: { port: number; phpPath: string }): Promise<void> {
    let port: number;
    let phpPath: string;

    if (params === undefined) {
        let config = await connection.workspace.getConfiguration('symfonyHelper');
        port = config.phpParser.port as number;
        phpPath = config.phpParser.phpPath as string;
    } else {
        port = params.port;
        phpPath = params.phpPath;
    }

    try {
        await nikic.restartParserProcess(port, phpPath);
    } catch (e) {
        if (e.message === 'start-failed') {
            connection.sendRequest('errorMessage', { message: 'Could not start php parser process' });
        }
    }
}

async function getConfiguration(): Promise<{ port: number; phpPath: string }> {
    let config = await connection.workspace.getConfiguration('symfonyHelper');

    let port: number = config.phpParser.port;
    let phpPath: string = config.phpParser.phpPath;

    return { port, phpPath };
}

connection.onInitialized(() => {
    (async (): Promise<void> => {
        service.setConnection(connection);

        connection.client.register(DidChangeConfigurationNotification.type, undefined);

        nikic.setErrorCallback((message) => {
            connection.sendRequest('errorMessage', { message });
        });

        let config = await getConfiguration();

        // it must be finished before calling 'Service#setProjects()'
        await tryRestartPhpParserProcess(config);

        service.setSettingsResolver(async (uri: string) => {
            let result = await connection.sendRequest<SymfonyHelperSettings|null>('getConfiguration', uri);

            let slashTrimmer = /^\/+|\/+$/g;

            if (result !== null) {
                result.templatesFolder = result.templatesFolder.replace(slashTrimmer, '');

                let newSourceFolders = [];
                for (let str of result.sourceFolders) {
                    newSourceFolders.push(str.replace(slashTrimmer, ''));
                }
                newSourceFolders = [... new Set(newSourceFolders)]; // remove duplicates
                newSourceFolders.sort();

                result.sourceFolders = newSourceFolders;
            }

            return result;
        });

        let workspaceFolders = await connection.workspace.getWorkspaceFolders();
        if (workspaceFolders !== null) {
            service.setProjects(workspaceFolders)
                .then(() => {})
                .catch(() => {})
                ;
        }

        connection.sendRequest('statusBarMessage', { message: 'initialized' });
    })()
        .catch(() => {});
});

connection.onDidChangeConfiguration(() => {
    (async (): Promise<void> => {
        let config = await getConfiguration();

        if (config.port !== nikic.getCurrentParserPort() || config.phpPath !== nikic.getCurrentPhpPath()) {
            await tryRestartPhpParserProcess(config);
        }
    })()
        .catch(() => {});
});

connection.onCompletion((params) => service.onCompletition(params));
connection.onDefinition((params) => service.onDefinition(params));
connection.onFoldingRanges((params) => service.onFoldingRanges(params));
connection.onHover((params) => service.onHover(params));
connection.onReferences((params) => service.onReferences(params));
connection.onSignatureHelp((params) => service.onSignatureHelp(params));

connection.onRequest('extendTemplate', params => service.commandExtendTemplate(params));
connection.onRequest('getNewTemplateFolder', params => service.getNewTemplateFolder(params));
connection.onRequest('openCompiledTemplate', params => service.commandOpenCompiledTemplate(params));
connection.onRequest('toggleTwigComment', params => service.commandToggleTwigComment(params));
connection.onRequest('rebuildIndexes', async () => {
    if (!nikic.isProcessFound()) {
        await tryRestartPhpParserProcess();
    }
    return service.commandRebuildIndexes();
});
connection.onRequest('restartPhpParser', async () => {
    await tryRestartPhpParserProcess();
});

connection.onRequest('documentChanged', (params) => {
    service.documentChanged(params.action, params.documentUri);
});

connection.onRequest('workspaceFoldersChanged', (params) => {
    service.setProjects(params.workspaceFolders);
});

connection.onExit(() => {
    stopParserProcess();
});

documents.onDidChangeContent((e) => {
    service.documentChanged('createdOrChanged', e.document.uri);
});

documents.listen(connection);
connection.listen();
