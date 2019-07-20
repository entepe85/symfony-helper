import * as path from 'path';
import * as fs from 'fs';
import { Service } from '../../src/service';
import { AllTextDocuments, packagePath, SymfonyHelperSettings } from '../../src/utils';
import * as nikic from '../../src/nikic-php-parser';
import URI from 'vscode-uri';

export let projectUri = URI.file(path.join(packagePath, 'symfony-4.2-project')).toString();
export let project34Uri = URI.file(path.join(packagePath, 'symfony-3.4-project')).toString();
export let projectAnyPhpUri = URI.file(path.join(packagePath, 'php-project-for-tests')).toString();

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

        service.setSettingsResolver(async (uri: string) => {
            let result: SymfonyHelperSettings;

            let templatesFolder = (uri === projectAnyPhpUri) ? 'views' : 'templates';

            if (process.env.COMMANDS_HELPER_TYPE === 'http') {
                fs.copyFileSync(packagePath + '/php-bin/symfony-commands.php', packagePath + '/symfony-3.4-project/public/vscode-symfony-helper.php');
                fs.copyFileSync(packagePath + '/php-bin/symfony-commands.php', packagePath + '/symfony-4.2-project/public/vscode-symfony-helper.php');

                result = {
                    consoleHelper: {
                        type: 'http',
                        phpPath: '',
                        webPath: 'http://localhost:8000/vscode-symfony-helper.php',
                    },
                    templatesFolder,
                }
            } else {
                result = {
                    consoleHelper: {
                        type: 'direct',
                        phpPath: 'php',
                        webPath: '',
                    },
                    templatesFolder,
                };
            }

            return result;
        });

        await service.setProjects([
            { uri: projectUri, name: path.basename(projectUri) },
            { uri: project34Uri, name: path.basename(project34Uri) },
            { uri: projectAnyPhpUri, name: path.basename(projectAnyPhpUri) },
        ]);
    }

    return service;
}
