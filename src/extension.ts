/**
 * This file is part of the 'Symfony Helper'
 * Copyright (c) 2019 Timur Morduhai
 * Licensed under the GNU General Public License
 */
import {
    ExtensionContext,
    commands,
    window,
    Uri,
    workspace,
    TextEditor,
    Range,
    Position,
    QuickPickItem,
    RelativePattern,
    Disposable,
    WorkspaceFolder,
    FileSystemWatcher,
} from 'vscode';

import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
} from 'vscode-languageclient';

import * as fs from 'fs';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
    let packageDirectory = __dirname + '/../..';
    let serverModule = packageDirectory + '/out/src/start-service.js';

    let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

    let serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: debugOptions
        }
    };

    let clientOptions: LanguageClientOptions = {
        documentSelector: [
            { pattern: '**/*.twig', scheme: 'file' },
            { pattern: '**/*.php', scheme: 'file' },
            { pattern: '**/*.yaml', scheme: 'file' },
            { pattern: '**/*.xml', scheme: 'file' },
        ],
    };

    client = new LanguageClient(
        'symfony-languageservice',
        'Symfony Language Service',
        serverOptions,
        clientOptions
    );

    context.subscriptions.push(client.start());

    context.subscriptions.push(commands.registerCommand('symfonyHelper.installHttpConsoleHelper', async function () {
        let folder = await window.showWorkspaceFolderPick();
        if (folder === undefined) {
            return;
        }

        try {
            fs.copyFileSync(packageDirectory + '/php-bin/symfony-commands.php', folder.uri.fsPath + '/public/vscode-symfony-helper.php');
            await window.showInformationMessage('Helper installed');
        } catch {
            await window.showErrorMessage('Could not install helper');
        }
    }));

    context.subscriptions.push(commands.registerCommand('symfonyHelper.rebuildIndexes', async function () {
        let response = await client.sendRequest<{success: true} | { success: false, message: string }>('rebuildIndexes');

        if (!response.success) {
            await window.showErrorMessage(response.message);
        }
    }));

    context.subscriptions.push(commands.registerCommand('symfonyHelper.restartPhpParser', async function () {
        client.sendRequest('restartPhpParser');
    }));

    context.subscriptions.push(commands.registerCommand('symfonyHelper.extendTemplate', async function (resource) {
        let baseTemplateUri: string | undefined; // absolute path to extended template

        if (resource) {
            if (resource.fsPath && resource.fsPath.endsWith('.twig') && resource.scheme === 'file') {
                baseTemplateUri = Uri.file(resource.fsPath).toString();
            }
        } else if (window.activeTextEditor) {
            baseTemplateUri = window.activeTextEditor.document.uri.toString();
        }

        if (baseTemplateUri === undefined || !baseTemplateUri.endsWith('.twig')) {
            await window.showErrorMessage('Template not selected');
            return;
        }

        let suffix = baseTemplateUri.endsWith('.html.twig') ? '.html.twig' : '.twig';

        let newTemplateFolderResponse = await client.sendRequest<{ success: boolean, message: string }>('getNewTemplateFolder', { baseTemplateUri });
        if (!newTemplateFolderResponse.success) {
            await window.showErrorMessage(newTemplateFolderResponse.message);
            return;
        }

        let prefix = newTemplateFolderResponse.message;

        let workspaceFolder = workspace.getWorkspaceFolder(Uri.parse(baseTemplateUri));

        if (!workspaceFolder) {
            await window.showErrorMessage('Template must be from workspace');
            return;
        }

        let input = await window.showInputBox({
            prompt: 'new file path',
            value: prefix + suffix,
            valueSelection: [prefix.length, prefix.length],
        });

        if (input === undefined || input === '') {
            return;
        }

        let response = await client.sendRequest<{ success: boolean, message: string, blocks?: { name: string, detail: string }[] }>('extendTemplate', {
            baseTemplateUri: baseTemplateUri,
            newTemplateRelativePath: input,
        });

        if (response.success) {
            try {
                await window.showTextDocument(Uri.parse(response.message));
            } catch (e) {
                await window.showErrorMessage('Could not open created file');
            }
        } else {
            if (response.blocks) {
                // select blocks and try again

                let items: QuickPickItem[] = [];
                for (let block of response.blocks) {
                    items.push({
                        label: block.name,
                        detail: block.detail,
                    });
                }
                let selected = await window.showQuickPick(
                    items,
                    {canPickMany: true, placeHolder: "Select blocks. Also you can configure '.symfony-helper.json'" }
                );
                if (selected === undefined) {
                    return;
                }

                let response2 = await client.sendRequest<{ success: boolean, message: string, blocks?: { name: string, detail: string }[] }>('extendTemplate', {
                    baseTemplateUri: baseTemplateUri,
                    newTemplateRelativePath: input,
                    selectedBlocks: selected.map(row => row.label),
                });

                if (response2.success) {
                    try {
                        await window.showTextDocument(Uri.parse(response2.message));
                    } catch (e) {
                        await window.showErrorMessage('Could not open created file');
                    }
                } else {
                    await window.showErrorMessage(response2.message);
                }
            } else {
                await window.showErrorMessage(response.message);
            }
        }
    }));

    context.subscriptions.push(commands.registerTextEditorCommand('symfonyHelper.openCompiledTemplate', async function (editor: TextEditor) {
        if (editor.document.uri.scheme !== 'file') {
            await window.showErrorMessage('This command is only for real files');
            return;
        }

        let uri = editor.document.uri.toString();

        let response = await client.sendRequest<{ success: boolean, message: string }>('openCompiledTemplate', {
            uri: uri,
        });

        if (response.success) {
            try {
                await window.showTextDocument(Uri.file(response.message));
            } catch (e) {
                await window.showErrorMessage('Could not open file');
            }
        } else {
            await window.showErrorMessage(response.message);
        }
    }));

    context.subscriptions.push(commands.registerTextEditorCommand('symfonyHelper.toggleTwigComment', async function (editor: TextEditor) {
        if (editor.document.uri.scheme !== 'file') {
            await window.showErrorMessage('This command is only for real files');
            return;
        }

        let uri = editor.document.uri.toString();

        if (!uri.endsWith('.twig')) {
            await window.showErrorMessage('This command is only for twig templates');
            return;
        }

        let response = await client.sendRequest<{ success: boolean, message: string }>('toggleTwigComment', {
            uri: uri,
            start: editor.selection.start,
            end: editor.selection.end,
        });

        if (!response.success) {
            await window.showErrorMessage(response.message);
            return;
        }

        let message: any;

        try {
            message = JSON.parse(response.message);
        } catch (e) {
            await window.showErrorMessage('Unexpected error');
            return;
        }

        await editor.edit((edit) => {
            if (message.deletions) {
                for (let row of message.deletions) {
                    edit.delete(new Range(row.start.line, row.start.character, row.end.line, row.end.character));
                }
            }

            if (message.insertions) {
                for (let { position, value } of message.insertions) {
                    edit.insert(new Position(position.line, position.character), value);
                }
            }
        });
    }));

    let complexFileWatcher = new ComplexFileWatcher(client);
    context.subscriptions.push(complexFileWatcher);

    complexFileWatcher.setFolders(workspace.workspaceFolders);

    context.subscriptions.push(workspace.onDidChangeWorkspaceFolders(() => {
        complexFileWatcher.setFolders(workspace.workspaceFolders);

        let folders: { uri: string, name: string }[] = [];
        if (workspace.workspaceFolders !== undefined) {
            folders = workspace.workspaceFolders.map(row => ({ uri: row.uri.toString(), name: row.name }));
        }

        client.sendRequest('workspaceFoldersChanged', {
            workspaceFolders: folders,
        });
    }));

    // status bar item
    {
        let statusBarItem = window.createStatusBarItem();

        context.subscriptions.push(statusBarItem);

        let baseText = 'Symfony Helper';

        statusBarItem.text = baseText;
        statusBarItem.show();

        client.onReady()
            .then(() => {
                client.onRequest('statusBarMessage', (request) => {
                    statusBarItem.text = baseText + ': ' + request.message;
                });
            })
            .catch(() => {});
    }

    client.onReady()
        .then(() => {
            client.onRequest('errorMessage', (request) => {
                window.showErrorMessage(request.message);
            });

            // why 'connect.workspace.getConfiguration()' on server side does not work?
            client.onRequest('consoleHelperConfiguration', (uri) => {
                let conf = workspace.getConfiguration('symfonyHelper.consoleHelper', Uri.parse(uri));
                return {
                    type: conf.get('type'),
                    phpPath: conf.get('phpPath'),
                    webPath: conf.get('webPath'),
                };
            });
        })
        .catch(() => {});
}

export function deactivate() {
    if (!client) {
        return undefined;
    }

    return client.stop();
}

class ComplexFileWatcher implements Disposable {
    private watchers: FileSystemWatcher[] = [];
    private client: LanguageClient;

    constructor(client: LanguageClient) {
        this.client = client;
    }

    public setFolders(folders: WorkspaceFolder[] | undefined) {
        for (let w of this.watchers) {
            w.dispose();
        }

        this.watchers.length = 0;

        if (folders !== undefined) {
            for (let f of folders) {
                let w1 = workspace.createFileSystemWatcher(new RelativePattern(f, '{config,src,templates,app}/**/*.{php,twig,yaml,xml}'));
                let w2 = workspace.createFileSystemWatcher(new RelativePattern(f, 'composer.lock'));
                let watchers = [w1, w2];

                for (let w of watchers) {
                    w.onDidChange((e) => {
                        this.client.sendRequest('documentChanged', {
                            documentUri: e.toString(),
                            action: 'createdOrChanged',
                        });
                    });

                    w.onDidCreate((e) => {
                        this.client.sendRequest('documentChanged', {
                            documentUri: e.toString(),
                            action: 'createdOrChanged',
                        });
                    });

                    w.onDidDelete((e) => {
                        this.client.sendRequest('documentChanged', {
                            documentUri: e.toString(),
                            action: 'deleted',
                        });
                    });

                    this.watchers.push(w);
                }
            }
        }
    }

    public dispose() {
        for (let w of this.watchers) {
            w.dispose();
        }
    }
}
