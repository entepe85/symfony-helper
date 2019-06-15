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
import { AllTextDocuments, ConsoleHelperSettings } from './utils';
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
                triggerCharacters: ['.', '"', "'", ':'], // '.' for dql, '"' and "'" for completion in '$this->getParameter()', ':' for twig
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

async function tryRestartPhpParserProcess(params?: { port: number, phpPath: string }) {
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

connection.onInitialized(async () => {
    service.setConnection(connection);

    connection.client.register(DidChangeConfigurationNotification.type, undefined);

    nikic.setErrorCallback((message) => {
        connection.sendRequest('errorMessage', { message: message });
    });

    let { portForParser, phpPathForParser } = await getConfiguration();

    // it must be finished before calling 'Service#setProjects()'
    await tryRestartPhpParserProcess({ port: portForParser, phpPath: phpPathForParser });

    service.setConsoleHelperSettingsResolver(async (uri: string) => {
        let result = await connection.sendRequest<ConsoleHelperSettings|null>('consoleHelperConfiguration', uri);
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
});

async function getConfiguration() {
    let config = await connection.workspace.getConfiguration('symfonyHelper');

    let portForParser: number = config.phpParser.port;
    let phpPathForParser: string = config.phpParser.phpPath;

    return { portForParser, phpPathForParser };
}

connection.onDidChangeConfiguration(async () => {
    let { portForParser, phpPathForParser } = await getConfiguration();

    if (portForParser !== nikic.getCurrentParserPort() || phpPathForParser !== nikic.getCurrentPhpPath()) {
        await tryRestartPhpParserProcess({ port: portForParser, phpPath: phpPathForParser });
    }
});

connection.onCompletion((params) => service.onCompletition(params));
connection.onDefinition((params) => service.onDefinition(params));
connection.onFoldingRanges((params) => service.onFoldingRanges(params));
connection.onHover((params) => service.onHover(params));
connection.onReferences((params) => service.onReferences(params));
connection.onSignatureHelp((params) => service.onSignatureHelp(params));

connection.onRequest('extendTemplate', params => service.commandExtendTemplate(params));
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
