import * as path from 'path';
import * as fs from 'fs';
import { Service } from '../../src/service';
import { AllTextDocuments, packagePath } from '../../src/utils';
import * as nikic from '../../src/nikic-php-parser';
import URI from 'vscode-uri';

export let projectUri = URI.file(path.join(packagePath, 'symfony-project-for-tests')).toString();

let service: Service;

let fakeFiles = [
    '/src/Controller/AFakeController.php',
    '/src/Controller/BFakeController.php',
];

export async function getService(): Promise<Service> {
    if (!service) {
        await nikic.restartParserProcess(7555, 'php');

        let fakeFilesMap: { [uri: string]: string } = {};
        for (let path of fakeFiles) {
            fakeFilesMap[projectUri + path] = projectUri + '/fake-files' + path;
        }

        service = new Service(AllTextDocuments.testInstance(fakeFilesMap));

        if (process.env.COMMANDS_HELPER_TYPE === 'http') {
            // I should start http server here
            fs.copyFileSync(packagePath + '/php-bin/symfony-commands.php', packagePath + '/symfony-project-for-tests/public/vscode-symfony-helper.php');
            service.setConsoleHelperSettingsResolver(async () => {
                return {
                    type: 'http',
                    phpPath: '',
                    webPath: 'http://localhost:8000/vscode-symfony-helper.php'
                };
            });
        } else {
            service.setConsoleHelperSettingsResolver(async () => {
                return {
                    type: 'direct',
                    phpPath: 'php',
                    webPath: ''
                };
            });
        }

        await service.setProjects([{uri: projectUri, name: path.basename(projectUri) }]);
    }

    return service;
}
