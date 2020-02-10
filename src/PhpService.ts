import {
    CompletionItem,
    CompletionItemKind,
    Definition,
    Hover,
    MarkupKind,
    Position,
    Range,
    TextDocument,
    TextEdit,
} from 'vscode-languageserver';

import * as dql from './dql';
import * as nikic from './nikic-php-parser';
import * as php from './php';
import * as utils from './utils';

import {
    collectEntitiesAliases,
    EntityData,
    isLooksLikeDQL,
    PhpClass,
    Project,
    targetEntityRegexp,
} from './project';

// preconditions for public methods:
//   * 'document' is inside of 'project'
export default class PhpService {
    public constructor(private allDocuments: utils.AllTextDocuments) {
    }

    public async complete(project: Project, document: TextDocument, position: Position): Promise<CompletionItem[]> {
        let offset = document.offsetAt(position);
        let code = document.getText();

        let stmts = await nikic.parse(code);
        if (stmts === null) {
            return [];
        }

        // complete autowiring typehints
        do {
            if (!project.isFromSourceFolders(document.uri)) {
                break;
            }

            let methodNodes = nikic.findNodesOfType(stmts, 'Stmt_ClassMethod') as nikic.Stmt_ClassMethod[];

            let methodTest = nikic.methodWithOffsetInArguments(code, methodNodes, offset);
            if (methodTest === null) {
                break;
            }

            let textToCursor = code.substring(methodTest.leftBracketIndex, offset);

            let match = /(,|\(|\s)\s*(\.[\w\.]*)$/.exec(textToCursor);
            if (match === null) {
                break;
            }

            let prefix = match[2];

            let useStatements = nikic.findUseStatements(stmts);

            let items: CompletionItem[] = [];

            for (let row of project.getAutowiredServices()) {
                let editRange = Range.create(document.positionAt(offset - prefix.length), document.positionAt(offset));
                let fullClassName = row.fullClassName;

                let className;
                if (fullClassName.includes('\\')) {
                    let pieces = fullClassName.split('\\');
                    className = pieces[pieces.length - 1];
                } else {
                    className = fullClassName;
                }

                let argumentName = className.replace(/_/, '');
                argumentName = argumentName[0].toLowerCase() + argumentName.substr(1);
                if (argumentName.endsWith('Interface')) {
                    argumentName = argumentName.substr(0, argumentName.length - 'Interface'.length);
                }

                let newTextPrefix = '\\' + fullClassName;
                let additionalTextEdits: TextEdit[] = [];
                {
                    if (fullClassName.includes('\\')) {
                        let stmt = useStatements.filter(d => d.fullName === fullClassName)[0];
                        if (stmt !== undefined) {
                            newTextPrefix = stmt.alias;
                        } else {
                            if (useStatements.length > 0) {
                                let lastUseStatement = useStatements[useStatements.length - 1];
                                let lastUseStatementPosition = document.positionAt(lastUseStatement.offset);
                                let newUseStatementPosition = Position.create(lastUseStatementPosition.line + 1, 0);
                                additionalTextEdits.push({
                                    newText: 'use ' + fullClassName + ';\n',
                                    range: Range.create(newUseStatementPosition, newUseStatementPosition),
                                });

                                let pieces = fullClassName.split('\\');
                                newTextPrefix = pieces[pieces.length - 1];
                            }
                        }
                    }
                }

                let newText = newTextPrefix + ' $' + argumentName;

                {
                    let use = (prefix.length === 1) || (prefix.length > 1 && className.toLowerCase().includes(prefix.substr(1).toLowerCase()));

                    if (use) {
                        let classBaseditem: CompletionItem = {
                            label: '.' + className,
                            textEdit: { newText, range: editRange },
                            detail: fullClassName,
                        };

                        if (row.serviceId !== undefined) {
                            classBaseditem.documentation = row.serviceId;
                        }

                        if (additionalTextEdits.length > 0) {
                            classBaseditem.additionalTextEdits = additionalTextEdits;
                        }

                        items.push(classBaseditem);
                    }
                }

                if (row.serviceId !== undefined) {
                    let serviceId = row.serviceId;
                    let use = (prefix.length === 1) || (prefix.length > 1 && serviceId.toLowerCase().includes(prefix.substr(1).toLowerCase()));
                    if (use) {
                        let idBasedItem: CompletionItem = {
                            label: '.' + serviceId,
                            textEdit: { newText, range: editRange },
                            detail: fullClassName,
                        };

                        if (additionalTextEdits.length > 0) {
                            idBasedItem.additionalTextEdits = additionalTextEdits;
                        }

                        items.push(idBasedItem);
                    }
                }
            }

            return items;
        } while (false);

        // completion of parameters and services in controllers
        do {
            if (!project.isSymfony()) {
                break;
            }

            if (!this.isController(project, document)) {
                break;
            }

            let codeToCursor = code.substr(0, offset);

            {
                // completion of parameters
                let match = /\$this\s*->\s*getParameter\s*\(\s*['"]([\w\.]*)$/.exec(codeToCursor);
                if (match !== null) {
                    let prefix = match[1];

                    let items: CompletionItem[] = [];
                    for (let name in project.getAllContainerParameters()) {
                        items.push({
                            label: name,
                            textEdit: {
                                range: Range.create(document.positionAt(offset - prefix.length), position),
                                newText: name,
                            }
                        });
                    }
                    return items;
                }
            }

            {
                // completion of services
                let match = /\$this\s*->\s*get\s*\(\s*['"]([\w\.]*)$/.exec(codeToCursor);
                if (match !== null) {
                    let prefix = match[1];

                    let allowedServices = [
                        'doctrine',
                        'form.factory',
                        'http_kernel',
                        'parameter_bag',
                        'request_stack',
                        'router',
                        'security.authorization_checker',
                        'security.csrf.token_manager',
                        'security.token_storage',
                        'serializer',
                        'session',
                        'twig',
                    ];

                    let items: CompletionItem[] = [];
                    for (let serviceName of allowedServices) {
                        items.push({
                            label: serviceName,
                            textEdit: {
                                range: Range.create(document.positionAt(offset - prefix.length), position),
                                newText: serviceName,
                            }
                        });
                    }
                    return items;
                }
            }
        } while (false);

        // complete route in UrlGeneratorInterface#generate() and AbstractController#generateUrl()
        do {
            if (!project.isSymfony()) {
                break;
            }

            if (!project.isFromSourceFolders(document.uri)) {
                break;
            }

            let isUrlGenerator = await this.isCursorInsideUrlGenerator(project, offset, stmts);

            let codeToCursor = code.substr(0, offset);

            let isControllerGenerator = this.isController(project, document) && /\$this\s*->\s*generateUrl\s*\(\s*['"]([\w-]*)$/.test(codeToCursor);

            if (!isUrlGenerator && !isControllerGenerator) {
                break;
            }

            let match = /['"]([\.\w-]*)$/.exec(codeToCursor);
            if (match === null) {
                break;
            }

            let prefix = match[1];

            let routes = project.getAllRoutes();

            let codeAfterCursor = code.substr(offset);

            let postfixMatch = /^([\.\w-]*)['"]\s*\)/.exec(codeAfterCursor);

            let items: CompletionItem[] = [];

            for (let row of routes) {
                let item: CompletionItem = {
                    label: row.name,
                    kind: CompletionItemKind.Method,
                    textEdit: {
                        newText: row.name,
                        range: Range.create(document.positionAt(offset - prefix.length), position),
                    },
                    detail: row.path,
                    documentation: row.controller,
                };

                if (row.pathParams.length > 0 && (postfixMatch !== null)) {
                    let postfix = postfixMatch[1];
                    let paramsPosition = document.positionAt(offset + postfix.length + 1);
                    let paramsText = ', [' + row.pathParams.map(name => `'${name}' => ''`).join(', ') + ']';
                    item.additionalTextEdits = [{
                        newText: paramsText,
                        range: Range.create(paramsPosition, paramsPosition),
                    }];
                }

                items.push(item);
            }

            return items;
        } while (false);

        {
            let items = await this.completeEntityField(project, document, stmts, position);
            if (items.length > 0) {
                return items;
            }
        }

        {
            let items = this.completeTemplateNameInPhp(project, document, position);
            if (items.length > 0) {
                return items;
            }
        }

        return [];
    }

    public async definition(project: Project, document: TextDocument, position: Position): Promise<Definition | null> {
        let offset = document.offsetAt(position);
        let code = document.getText();

        let stmts = await nikic.parse(code);
        if (stmts === null) {
            return null;
        }

        let scalarString = nikic.findStringContainingOffset(stmts, offset);
        if (scalarString === null) {
            // test autowired argument
            {
                let result = this.testAutowiredArgment(project, document, code, stmts, offset);
                if (result !== null) {
                    let serviceInfo = project.getService(result.serviceId);
                    if (serviceInfo !== undefined) {
                        let serviceDocument = await this.getDocument(serviceInfo.fileUri);
                        if (serviceDocument !== null) {
                            let servicePosition = serviceDocument.positionAt(serviceInfo.tagStartOffset);

                            return {
                                uri: serviceInfo.fileUri,
                                range: Range.create(servicePosition, servicePosition),
                            };
                        }
                    }
                }
            }

            // test 'targetEntity' and 'repositoryClass' in entity class
            {
                let result = this.testTargetEntity(project, document, stmts, offset);

                if (result === null) {
                    result = this.testRepositoryClass(project, document, stmts, offset);
                }

                if (result === null) {
                    result = this.testClassOfEmbedded(project, document, stmts, offset);
                }

                if (result !== null) {
                    let phpClass = await project.getPhpClass(result.fullClassName);
                    if (phpClass !== null) {
                        let phpClassDocument = await this.getDocument(phpClass.fileUri);
                        if (phpClassDocument !== null) {
                            let classPosition = phpClassDocument.positionAt(phpClass.offset);
                            return {
                                uri: phpClass.fileUri,
                                range: Range.create(classPosition, classPosition),
                            };
                        }
                    }
                }
            }

            return null;
        }

        if (isLooksLikeDQL(scalarString.value)) {
            return this.definitionDql(project, scalarString, document, offset);
        }

        // test route name
        {
            let result = await this.testRouteName(project, document, code, stmts, offset, scalarString);

            if (result !== null) {
                let controllerLocation = await project.routeLocation(result.route);

                if (controllerLocation !== null) {
                    return controllerLocation;
                }
            }
        }

        // test service name
        {
            let result = this.testServiceName(project, document, code, offset, scalarString);

            if (result !== null) {
                let { service } = result;

                let xmlDocument = await this.getDocument(service.fileUri);

                if (xmlDocument !== null) {
                    let tagPosition = xmlDocument.positionAt(service.tagStartOffset);

                    return {
                        uri: service.fileUri,
                        range: Range.create(tagPosition, tagPosition),
                    };
                }
            }
        }

        // test container parameter name
        {
            let result = this.testContainerParameterName(project, document, code, scalarString);

            if (result !== null) {
                for (let fileUri in project.containerParametersPositions) {
                    let parameterMap = project.containerParametersPositions[fileUri];
                    if (parameterMap[result.name] !== undefined) {
                        let paramOffset = parameterMap[result.name].offset;

                        let fileDocument = await this.getDocument(fileUri);

                        if (fileDocument !== null) {
                            let paramPosition = fileDocument.positionAt(paramOffset);

                            return {
                                uri: fileUri,
                                range: Range.create(paramPosition, paramPosition),
                            };
                        }
                    }
                }
            }
        }

        // go to template
        if (scalarString.value.endsWith('.twig')) {
            let templateName = scalarString.value;
            let templateInfo = project.getTemplate(templateName);

            if (templateInfo !== null) {
                return [{
                    uri: templateInfo.fileUri,
                    range: Range.create(0, 0, 0, 0),
                }];
            }
        }

        return null;
    }

    public async hover(project: Project, document: TextDocument, position: Position): Promise<Hover | null> {
        let offset = document.offsetAt(position);
        let code = document.getText();

        let stmts = await nikic.parse(code);
        if (stmts === null) {
            return null;
        }

        let scalarString = nikic.findStringContainingOffset(stmts, offset);
        if (scalarString === null) {
            // test autowired argument
            {
                let result = this.testAutowiredArgment(project, document, code, stmts, offset);
                if (result !== null) {
                    let hoverMarkdown = ['```', result.serviceId, '```'].join('\n');

                    return {
                        contents: {
                            value: hoverMarkdown,
                            kind: MarkupKind.Markdown,
                        },
                        range: Range.create(
                            document.positionAt(result.hoverLeftOffset),
                            document.positionAt(result.hoverRightOffset)
                        )
                    };
                }
            }

            // test 'targetEntity' and 'repositoryClass' in entity class
            {
                let result = this.testTargetEntity(project, document, stmts, offset);

                if (result === null) {
                    result = this.testRepositoryClass(project, document, stmts, offset);
                }

                if (result === null) {
                    result = this.testClassOfEmbedded(project, document, stmts, offset);
                }

                if (result !== null) {
                    let hoverMarkdown = await project.phpClassHoverMarkdown(result.fullClassName);

                    if (hoverMarkdown !== null) {
                        return {
                            contents: {
                                kind: MarkupKind.Markdown,
                                value: hoverMarkdown,
                            },
                            range: Range.create(
                                document.positionAt(result.hoverLeftOffset),
                                document.positionAt(result.hoverRightOffset)
                            )
                        };
                    }
                }
            }

            return null;
        }

        if (isLooksLikeDQL(scalarString.value)) {
            return this.hoverDql(project, scalarString, document, offset);
        }

        // test route name
        {
            let result = await this.testRouteName(project, document, code, stmts, offset, scalarString);

            if (result !== null) {
                let hoverMarkdown = project.routeHoverMarkdown(result.route);
                if (hoverMarkdown !== null) {
                    return {
                        contents: {
                            value: hoverMarkdown,
                            kind: MarkupKind.Markdown,
                        },
                        range: Range.create(
                            document.positionAt(result.hoverLeftOffset),
                            document.positionAt(result.hoverRightOffset)
                        )
                    };
                }
            }
        }

        // test service name
        {
            let result = this.testServiceName(project, document, code, offset, scalarString);

            if (result !== null) {
                let hoverMarkdown = project.serviceHoverMarkdown(result.service);

                return {
                    range: Range.create(
                        document.positionAt(result.hoverLeftOffset),
                        document.positionAt(result.hoverRightOffset)
                    ),
                    contents: {
                        kind: MarkupKind.Markdown,
                        value: hoverMarkdown,
                    }
                };
            }
        }

        // test container parameter name
        {
            let result = this.testContainerParameterName(project, document, code, scalarString);

            if (result !== null && project.isSymfony()) {
                let value = project.getContainerParameter(result.name);

                if (value !== undefined) {
                    let printValue: string;
                    if (value === null) {
                        printValue = 'null';
                    } else if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
                        printValue = '' + value;
                    } else if (typeof value === 'object') {
                        printValue = 'some object';
                    } else if (value.length !== undefined) {
                        printValue = 'some array';
                    } else {
                        printValue = 'some value';
                    }

                    let markdown = ['```', printValue, '```'].join('\n');

                    return {
                        contents: {
                            kind: MarkupKind.Markdown,
                            value: markdown,
                        },
                        range: Range.create(
                            document.positionAt(result.hoverLeftOffset),
                            document.positionAt(result.hoverRightOffset)
                        ),
                    };
                }
            }
        }

        return null;
    }

    private async definitionDql(project: Project, scalarString: nikic.Scalar_String, document: TextDocument, offset: number): Promise<Definition | null> {
        let result = await project.dqlTestPosition(scalarString, document, offset);

        if (result === null) {
            return null;
        }

        if (result.type === 'entityClass') {
            for (let fileUri in project.xmlFiles) {
                let entity = project.xmlFiles[fileUri].entity;
                if (entity !== undefined && entity.className === result.className) {
                    let xmlDocument = await this.getDocument(fileUri);
                    if (xmlDocument !== null) {
                        let pos = xmlDocument.positionAt(entity.offset);
                        return {
                            uri: fileUri,
                            range: Range.create(pos, pos),
                        };
                    }
                }
            }

            let phpClass = await project.getPhpClass(result.className);

            if (phpClass !== null && phpClass.entity !== undefined) {
                let classDocument = await this.getDocument(phpClass.fileUri);

                if (classDocument !== null) {
                    let classPosition = classDocument.positionAt(phpClass.offset);

                    return {
                        uri: phpClass.fileUri,
                        range: Range.create(classPosition, classPosition),
                    };
                }
            }
        } else if (result.type === 'entityField') {
            let result2 = await project.accessEntityWithPath(result.className, result.accessPath);

            if (result2 !== null) {
                let { phpClass, phpClassField } = result2;

                for (let fileUri in project.xmlFiles) {
                    let entity = project.xmlFiles[fileUri].entity;
                    if (entity !== undefined && entity.className === phpClass.fullClassName) {
                        let xmlDocument = await this.getDocument(fileUri);
                        if (xmlDocument !== null) {
                            let pos = xmlDocument.positionAt(phpClassField.offset);
                            return {
                                uri: fileUri,
                                range: Range.create(pos, pos),
                            };
                        }
                    }
                }

                let classDocument = await this.getDocument(phpClass.fileUri);

                if (classDocument !== null) {
                    let fieldPosition = classDocument.positionAt(phpClassField.offset);

                    return {
                        uri: phpClass.fileUri,
                        range: Range.create(fieldPosition, fieldPosition),
                    };
                }
            }
        }

        return null;
    }

    private async hoverDql(project: Project, scalarString: nikic.Scalar_String, document: TextDocument, offset: number): Promise<Hover | null> {
        let result = await project.dqlTestPosition(scalarString, document, offset);

        if (result === null) {
            return null;
        }

        if (result.type === 'entityClass') {
            let phpClass = await project.getPhpClass(result.className);

            if (phpClass !== null) {
                let classHoverMarkdown = await project.phpClassHoverMarkdown(result.className);
                if (classHoverMarkdown !== null) {
                    return {
                        contents: {
                            value: classHoverMarkdown,
                            kind: MarkupKind.Markdown,
                        },
                        range: Range.create(
                            document.positionAt(result.hoverLeftOffset),
                            document.positionAt(result.hoverRightOffset)
                        ),
                    };
                }
            }
        } else if (result.type === 'entityField') {
            let result2 = await project.accessEntityWithPath(result.className, result.accessPath);

            if (result2 !== null) {
                let { phpClass, phpClassField } = result2;

                let fieldHoverMarkdown = await project.phpClassHoverMarkdown(phpClass.fullClassName, 'property', phpClassField.name);

                if (fieldHoverMarkdown !== null) {
                    return {
                        contents: {
                            value: fieldHoverMarkdown,
                            kind: MarkupKind.Markdown,
                        },
                        range: Range.create(
                            document.positionAt(result.hoverLeftOffset),
                            document.positionAt(result.hoverRightOffset)
                        ),
                    };
                }
            }
        }

        return null;
    }

    private testAutowiredArgment(project: Project, document: TextDocument, code: string, stmts: nikic.Statement[], offset: number) {
        if (!project.isFromSourceFolders(document.uri)) {
            return null;
        }

        let methodNodes = nikic.findNodesOfType(stmts, 'Stmt_ClassMethod') as nikic.Stmt_ClassMethod[];

        let methodTest = nikic.methodWithOffsetInArguments(code, methodNodes, offset);
        if (methodTest === null) {
            return null;
        }

        let methodNode = methodTest.node;

        let cursorParam: nikic.Param | undefined;

        for (let param of methodNode.params) {
            if (typeof param.var.name === 'string') {
                if (param.var.attributes.startFilePos <= offset && offset <= param.var.attributes.endFilePos + 1) {
                    cursorParam = param;
                }
            }
        }

        if (cursorParam === undefined || cursorParam.type === null) {
            return null;
        }

        let nameResolverData = nikic.findNameResolverData(stmts);

        if (!(cursorParam.type.nodeType === 'Name' || cursorParam.type.nodeType === 'Name_FullyQualified')) {
            return null;
        }

        let className: string;
        if (cursorParam.type.nodeType === 'Name') {
            className = nikic.resolveName(cursorParam.type.parts, nameResolverData);
        } else if (cursorParam.type.nodeType === 'Name_FullyQualified') {
            className = cursorParam.type.parts.join('\\');
        } else {
            return null;
        }

        for (let row of project.getAutowiredServices()) {
            if (row.fullClassName === className) {
                if (row.serviceId === undefined) {
                    break;
                }

                return {
                    serviceId: row.serviceId,
                    hoverLeftOffset: cursorParam.var.attributes.startFilePos,
                    hoverRightOffset: cursorParam.var.attributes.endFilePos + 1,
                };
            }
        }

        return null;
    }

    /**
     * Tests 'targetEntity' attribute of entity annotation
     */
    private testTargetEntity(project: Project, document: TextDocument, stmts: nikic.Statement[], offset: number) {
        let phpClass = project.phpClasses[document.uri];
        if (phpClass === undefined || phpClass.entity === undefined) {
            return null;
        }

        let namespaceStmt = stmts.filter(row => row.nodeType === 'Stmt_Namespace')[0] as nikic.Stmt_Namespace;
        if (namespaceStmt === undefined) {
            return null;
        }

        let classStmt = namespaceStmt.stmts.filter(row => row.nodeType === 'Stmt_Class')[0] as nikic.Stmt_Class;
        if (classStmt === undefined) {
            return null;
        }

        let commentNode: nikic.Comment_Doc | undefined;

        for (let stmt of classStmt.stmts) {
            if (stmt.nodeType !== 'Stmt_Property') {
                continue;
            }

            let propCommentNode = nikic.lastDocComment(stmt.attributes.comments);
            if (propCommentNode === null) {
                continue;
            }

            if (propCommentNode.filePos <= offset && offset <= propCommentNode.filePos + propCommentNode.text.length) {
                commentNode = propCommentNode;
                break;
            }
        }

        if (commentNode === undefined) {
            return null;
        }

        let comment = commentNode.text;

        let match = targetEntityRegexp.exec(comment);
        if (match === null || match.index === undefined) {
            return null;
        }

        let name = match[4];
        let nameStartOffset = commentNode.filePos + match.index + match[1].length;

        if (!(nameStartOffset <= offset && offset <= nameStartOffset + name.length)) {
            return null;
        }

        let namespace = namespaceStmt.name.parts.join('\\');

        let fullClassName: string;
        if (name.includes('\\')) {
            if (name.startsWith('\\')) {
                fullClassName = name.substr(1);
            } else {
                fullClassName = name;
            }
        } else {
            fullClassName = namespace + '\\' + name;
        }

        return {
            fullClassName,
            hoverLeftOffset: nameStartOffset,
            hoverRightOffset: nameStartOffset + name.length,
        };
    }

    /**
     * Tests 'repositoryClass' attribute of entity annotation
     */
    private testRepositoryClass(project: Project, document: TextDocument, stmts: nikic.Statement[], offset: number) {
        let phpClass = project.phpClasses[document.uri];
        if (phpClass === undefined || phpClass.entity === undefined) {
            return null;
        }

        let namespaceStmt = stmts.filter(row => row.nodeType === 'Stmt_Namespace')[0] as nikic.Stmt_Namespace;
        if (namespaceStmt === undefined) {
            return null;
        }

        let classStmt = namespaceStmt.stmts.filter(row => row.nodeType === 'Stmt_Class')[0] as nikic.Stmt_Class;
        if (classStmt === undefined) {
            return null;
        }

        let commentNode = nikic.lastDocComment(classStmt.attributes.comments);

        if (commentNode === null) {
            return null;
        }

        let comment = commentNode.text;

        let match = /(\WrepositoryClass\s*=\s*["'])([\w\\]+)["']/.exec(comment);
        if (match === null || match.index === undefined) {
            return null;
        }

        let name = match[2];
        let nameStartOffset = commentNode.filePos + match.index + match[1].length;

        if (!(nameStartOffset <= offset && offset <= nameStartOffset + name.length)) {
            return null;
        }

        let namespace = namespaceStmt.name.parts.join('\\');

        let fullClassName: string;
        if (name.includes('\\')) {
            if (name.startsWith('\\')) {
                fullClassName = name.substr(1);
            } else {
                fullClassName = name;
            }
        } else {
            fullClassName = namespace + '\\' + name;
        }

        return {
            fullClassName,
            hoverLeftOffset: nameStartOffset,
            hoverRightOffset: nameStartOffset + name.length,
        };
    }

    /**
     * Tests 'class' attribute of '@Embedded'
     */
    private testClassOfEmbedded(project: Project, document: TextDocument, stmts: nikic.Statement[], offset: number) {
        let phpClass = project.phpClasses[document.uri];
        if (phpClass === undefined || phpClass.entity === undefined) {
            return null;
        }

        let namespaceStmt = stmts.filter(row => row.nodeType === 'Stmt_Namespace')[0] as nikic.Stmt_Namespace;
        if (namespaceStmt === undefined) {
            return null;
        }

        let classStmt = namespaceStmt.stmts.filter(row => row.nodeType === 'Stmt_Class')[0] as nikic.Stmt_Class;
        if (classStmt === undefined) {
            return null;
        }

        let commentNode: nikic.Comment_Doc | undefined;

        for (let stmt of classStmt.stmts) {
            if (stmt.nodeType !== 'Stmt_Property') {
                continue;
            }

            let propCommentNode = nikic.lastDocComment(stmt.attributes.comments);
            if (propCommentNode === null) {
                continue;
            }

            if (propCommentNode.filePos <= offset && offset <= propCommentNode.filePos + propCommentNode.text.length) {
                commentNode = propCommentNode;
                break;
            }
        }

        if (commentNode === undefined) {
            return null;
        }

        let comment = commentNode.text;

        let match = /(@(ORM\\)?Embedded\s*\(.*class\s*=\s*["'])([\w\\]+)["']/.exec(comment);
        if (match === null || match.index === undefined) {
            return null;
        }

        let name = match[3];
        let nameStartOffset = commentNode.filePos + match.index + match[1].length;

        if (!(nameStartOffset <= offset && offset <= nameStartOffset + name.length)) {
            return null;
        }

        let namespace = namespaceStmt.name.parts.join('\\');

        let fullClassName: string;
        if (name.includes('\\')) {
            if (name.startsWith('\\')) {
                fullClassName = name.substr(1);
            } else {
                fullClassName = name;
            }
        } else {
            fullClassName = namespace + '\\' + name;
        }

        return {
            fullClassName,
            hoverLeftOffset: nameStartOffset,
            hoverRightOffset: nameStartOffset + name.length,
        };
    }

    /**
     * Tests route name in '$this->generateUrl()' and 'UrlGeneratorInterface::generate()'
     */
    private async testRouteName(project: Project, document: TextDocument, code: string, stmts: nikic.Statement[], offset: number, scalarString: nikic.Scalar_String) {
        let routeName: string | undefined;

        // test for '$this->generateUrl()'
        do {
            if (!this.isController(project, document)) {
                break;
            }

            let codeToCursor = code.substr(0, offset);

            let match = /\$this\s*->\s*generateUrl\s*\(\s*['"]([\w-]*)$/.exec(codeToCursor);
            if (match !== null) {
                routeName = scalarString.value;
            }
        } while (false);

        // test for 'UrlGeneratorInterface::generate()'
        do {
            if (routeName !== undefined) {
                break;
            }

            if (!project.isFromSourceFolders(document.uri)) {
                break;
            }

            let isCursorInsideUrlGenerator = await this.isCursorInsideUrlGenerator(project, offset, stmts);
            if (isCursorInsideUrlGenerator === false) {
                break;
            }

            routeName = isCursorInsideUrlGenerator.value;
        } while (false);

        if (routeName === undefined) {
            return null;
        }

        return {
            route: routeName,
            hoverLeftOffset: scalarString.attributes.startFilePos,
            hoverRightOffset: scalarString.attributes.endFilePos + 1,
        };
    }

    private testServiceName(project: Project, document: TextDocument, code: string, offset: number, scalarString: nikic.Scalar_String) {
        if (!this.isController(project, document)) {
            return null;
        }

        let codeToCursor = code.substr(0, offset);

        if (!/\$this\s*->\s*get\s*\(\s*['"]([\w\.\\]*)$/.test(codeToCursor)) {
            return null;
        }

        let serviceName = scalarString.value;

        let service = project.getService(serviceName);

        if (service === undefined) {
            return null;
        }

        return {
            service,
            hoverLeftOffset: scalarString.attributes.startFilePos,
            hoverRightOffset: scalarString.attributes.endFilePos + 1,
        };
    }

    private testContainerParameterName(project: Project, document: TextDocument, code: string, scalarString: nikic.Scalar_String) {
        let parameterName: string | undefined;

        // test for '$this->getParameter()'
        do {
            if (!this.isController(project, document)) {
                break;
            }

            let codeToScalarString = code.substr(0, scalarString.attributes.startFilePos);

            let match = /\$this\s*->\s*getParameter\s*\(\s*$/.exec(codeToScalarString);
            if (match !== null) {
                parameterName = scalarString.value;
            }
        } while (false);

        if (parameterName === undefined) {
            return null;
        }

        return {
            name: parameterName,
            hoverLeftOffset: scalarString.attributes.startFilePos,
            hoverRightOffset: scalarString.attributes.endFilePos + 1,
        };
    }

    private async completeEntityField(project: Project, document: TextDocument, stmts: nikic.Statement[], position: Position): Promise<CompletionItem[]> {
        let cursorOffset = document.offsetAt(position);

        let scalarString = nikic.findStringContainingOffset(stmts, cursorOffset);
        if (scalarString === null) {
            return [];
        }

        if (!isLooksLikeDQL(scalarString.value)) {
            return [];
        }

        let fullScalar = document.getText().substring(scalarString.attributes.startFilePos, scalarString.attributes.endFilePos + 1);

        let scalarStringValueIndex = fullScalar.indexOf(scalarString.value);
        if (scalarStringValueIndex < 0) {
            return [];
        }

        let stringLiteralOffset = scalarString.attributes.startFilePos + scalarStringValueIndex;

        let tokens = dql.tokenize(scalarString.value);

        let entities = project.getEntities();

        let identifierToEntity = collectEntitiesAliases(tokens, entities, project.getDoctrineEntityNamespaces());

        let cursorOffsetInString = cursorOffset - stringLiteralOffset;

        let dotBeforeCursorIndex: number | undefined;
        for (let i = 0; i < tokens.length; i++) {
            let token = tokens[i];
            if (token.type === dql.TokenType.DOT) {
                if (token.position < cursorOffsetInString) {
                    dotBeforeCursorIndex = i;
                } else {
                    break;
                }
            }
        }

        if (dotBeforeCursorIndex === undefined) {
            return [];
        }

        let textBetweenDotAndCursor = scalarString.value.substring(tokens[dotBeforeCursorIndex].position + 1, cursorOffsetInString);
        if (!/^\w*$/.test(textBetweenDotAndCursor)) {
            return [];
        }

        let accessPath: string[] = [];

        for (let i = dotBeforeCursorIndex - 1; i >= 0; i -= 2) {
            let possibleIdentifier = tokens[i];
            let possibleDot = tokens[i + 1];

            if (possibleDot.type === dql.TokenType.DOT) {
                if (possibleIdentifier.type === dql.TokenType.IDENTIFIER && dql.touchEachOther(possibleIdentifier, possibleDot)) {
                    accessPath.unshift(possibleIdentifier.value);
                } else {
                    // something bad happened
                    accessPath.length = 0;
                    break;
                }
            } else {
                break;
            }
        }

        if (accessPath.length === 0) {
            return [];
        }

        if (identifierToEntity[accessPath[0]] === undefined) {
            return [];
        }

        let phpClass: PhpClass | null;

        if (accessPath.length === 1) {
            phpClass = await project.getPhpClass(identifierToEntity[accessPath[0]]);
        } else {
            let result = await project.accessEntityWithPath(identifierToEntity[accessPath[0]], accessPath.slice(1));
            if (result === null) {
                return [];
            }

            if (result.phpClassField.isEmbedded) {
                phpClass = await project.getPhpClass(result.phpClassField.type);
            } else {
                phpClass = null;
            }
        }

        if (phpClass === null) {
            return [];
        }

        let entityData: undefined | EntityData;

        for (let fileUri in project.xmlFiles) {
            let entity = project.xmlFiles[fileUri].entity;
            if (entity !== undefined && entity.className === phpClass.fullClassName) {
                entityData = entity;
                break;
            }
        }

        if (entityData === undefined) {
            if (phpClass.entity !== undefined) {
                entityData = phpClass.entity;
            }
        }

        if (entityData === undefined) {
            return [];
        }

        let items: CompletionItem[] = [];

        for (let field of entityData.fields) {
            let item: CompletionItem = {
                label: field.name,
                kind: CompletionItemKind.Property,
                textEdit: {
                    range: Range.create(
                        document.positionAt(cursorOffset - textBetweenDotAndCursor.length),
                        position
                    ),
                    newText: field.name,
                },
                detail: field.type,
            };

            let doc = await project.phpClassHoverMarkdown(phpClass.fullClassName, 'property', field.name);
            if (doc !== null) {
                item.documentation = {
                    kind: MarkupKind.Markdown,
                    value: doc,
                };
            }

            items.push(item);
        }

        return items;
    }

    private completeTemplateNameInPhp(project: Project, document: TextDocument, position: Position): CompletionItem[] {
        let offset = document.offsetAt(position);
        let lines = document.getText().split('\n');
        let line = lines[position.line].substring(0, position.character);

        let match = /[^\w](render|renderView)\s*\(\s*(['"]?[@!\w\./\-]*)?$/.exec(line);
        let isQuotePlaced = false;
        let existingPrefix = '';
        if (match !== null) {
            if (match[2] !== undefined) {
                if (match[2].startsWith('"') || match[2].startsWith('\'')) {
                    existingPrefix = match[2].substr(1);
                    isQuotePlaced = true;
                } else {
                    existingPrefix = match[2];
                }
            }
        } else {
            // try previous line
            if (position.line > 1) {
                let prevLine = lines[position.line - 1];
                let prevLineMatch = /[^\w](render|renderView)\s*\(\s*$/.exec(prevLine);
                let lineMatch = /\s*(['"]?[@!\w\./\-]*)?$/.exec(line);
                if (prevLineMatch === null || lineMatch === null) {
                    return [];
                }

                if (lineMatch[1] !== undefined) {
                    if (lineMatch[1].startsWith('"') || lineMatch[1].startsWith('\'')) {
                        existingPrefix = lineMatch[1].substr(1);
                        isQuotePlaced = true;
                    } else {
                        existingPrefix = lineMatch[1];
                    }
                }
            } else {
                return [];
            }
        }

        let items: CompletionItem[] = [];

        for (let fileUri in project.templates) {
            let name = project.templates[fileUri].name;

            if (name.startsWith('bundles/')) {
                continue;
            }

            // fast hack. should be improved and tested.
            if (existingPrefix.startsWith('@')) {
                if (!name.startsWith('@')) {
                    continue;
                }
                if (!name.toLowerCase().includes(existingPrefix.substr(1).toLowerCase())) {
                    continue;
                }
            } else {
                if (name.startsWith('@')) {
                    continue;
                }
            }

            let newText = name;
            if (!isQuotePlaced) {
                newText = '\'' + name + '\'';
            }

            items.push({
                label: name,
                kind: CompletionItemKind.File,
                textEdit: {
                    newText,
                    range: Range.create(document.positionAt(offset - existingPrefix.length), position),
                }
            });
        }

        return items;
    }

    /**
     * Tests if cursor inside of first parameter of UrlGeneratorInterface::generate() and that first parameter is string
     */
    private async isCursorInsideUrlGenerator(project: Project, offset: number, fileStmts: nikic.Statement[]): Promise<false | nikic.Scalar_String> {
        let stmts = fileStmts;

        let nameResolverData = nikic.findNameResolverData(stmts);

        let methodNode: nikic.Stmt_ClassMethod | undefined;

        let classMethodsNodes = nikic.findNodesOfType(stmts, 'Stmt_ClassMethod') as nikic.Stmt_ClassMethod[];
        for (let m of classMethodsNodes) {
            if (m.attributes.startFilePos < offset && offset <= m.attributes.endFilePos) {
                methodNode = m;
                break;
            }
        }

        if (methodNode === undefined) {
            return false;
        }

        let methodSymbols = await project.symbolTable(methodNode, nameResolverData);

        let methodCall: nikic.Expr_MethodCall | undefined;

        let methodCallNodes = nikic.findNodesOfType(methodNode, 'Expr_MethodCall') as nikic.Expr_MethodCall[];
        for (let i = 0; i < methodCallNodes.length; i++) {
            let call = methodCallNodes[methodCallNodes.length - 1 - i];

            if (call.attributes.startFilePos < offset && offset <= call.attributes.endFilePos) {
                methodCall = call;
                break;
            }
        }

        if (methodCall === undefined) {
            return false;
        }

        if (methodCall.name.nodeType !== 'Identifier' || methodCall.name.name !== 'generate') {
            return false;
        }

        if (methodCall.var.nodeType !== 'Expr_Variable' || typeof methodCall.var.name !== 'string') {
            return false;
        }

        let varName = methodCall.var.name;

        let varType = methodSymbols[varName];
        if (!(varType instanceof php.ObjectType && varType.getClassName() === 'Symfony\\Component\\Routing\\Generator\\UrlGeneratorInterface')) {
            return false;
        }

        if (methodCall.args.length === 0) {
            return false;
        }

        let firstArgValue = methodCall.args[0].value;
        if (firstArgValue.nodeType !== 'Scalar_String') {
            return false;
        }

        if (!(firstArgValue.attributes.startFilePos < offset && offset <= firstArgValue.attributes.endFilePos)) {
            return false;
        }

        return firstArgValue;
    }

    private isController(project: Project, document: TextDocument): boolean {
        let code = document.getText();

        return document.uri.startsWith(project.getFolderUri() + '/src/')
            && (
                code.includes('extends AbstractController')
                || code.includes('extends Controller')
            );
    }

    private async getDocument(uri: string): Promise<TextDocument | null> {
        return this.allDocuments.get(uri);
    }
}
