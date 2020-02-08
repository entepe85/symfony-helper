import {
    workspace,
    RelativePattern,
    Disposable,
    WorkspaceFolder,
    FileSystemWatcher,
} from 'vscode';

import {
    LanguageClient,
} from 'vscode-languageclient';

class ComplexFileWatcher implements Disposable {
    private watchers: FileSystemWatcher[] = [];
    private client: LanguageClient;

    constructor(client: LanguageClient) {
        this.client = client;
    }

    public setFolders(folders: WorkspaceFolder[] | undefined): void {
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

    public dispose(): void {
        for (let w of this.watchers) {
            w.dispose();
        }
    }
}

export default ComplexFileWatcher;
