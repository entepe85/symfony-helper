import * as path from 'path';
import * as fs from 'fs';
import { Service } from '../../src/service';
import { AllTextDocuments, packagePath, SymfonyHelperSettings } from '../../src/utils';
import * as nikic from '../../src/nikic-php-parser';
import URI from 'vscode-uri';

export const projectUri = URI.file(path.join(packagePath, 'symfony-4.2-project')).toString();
export const project34Uri = URI.file(path.join(packagePath, 'symfony-3.4-project')).toString();
export const project28Uri = URI.file(path.join(packagePath, 'symfony-2.8-project')).toString();
export const projectAnyPhpUri = URI.file(path.join(packagePath, 'php-project-for-tests')).toString();

let portA = 6300;
let portB = 6301;
let portC = 6302;

export const serversConf = [
    { port: portA, folderPath: path.join(packagePath, 'symfony-4.2-project', 'public') },
    { port: portB, folderPath: path.join(packagePath, 'symfony-3.4-project', 'web') },
    { port: portC, folderPath: path.join(packagePath, 'symfony-2.8-project', 'web') },
];

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
            let sourceFolders = (uri === projectAnyPhpUri) ? ['php-classes', 'php-functions'] : [];

            if (process.env.COMMANDS_HELPER_TYPE === 'http') {
                fs.copyFileSync(packagePath + '/php-bin/symfony-commands.php', packagePath + '/symfony-2.8-project/web/vscode-symfony-helper.php');
                fs.copyFileSync(packagePath + '/php-bin/symfony-commands.php', packagePath + '/symfony-3.4-project/web/vscode-symfony-helper.php');
                fs.copyFileSync(packagePath + '/php-bin/symfony-commands.php', packagePath + '/symfony-4.2-project/public/vscode-symfony-helper.php');

                let consoleHelperSettings: { type: 'http', phpPath: string, webPath: string };

                if (uri === projectUri) {
                    consoleHelperSettings = {
                        type: 'http',
                        phpPath: '',
                        webPath: 'http://localhost:' + portA + '/vscode-symfony-helper.php',
                    };
                } else if (uri === project34Uri) {
                    consoleHelperSettings = {
                        type: 'http',
                        phpPath: '',
                        webPath: 'http://localhost:' + portB + '/vscode-symfony-helper.php',
                    };
                } else {
                    consoleHelperSettings = {
                        type: 'http',
                        phpPath: '',
                        webPath: 'http://localhost:' + portC + '/vscode-symfony-helper.php',
                    };
                }

                result = {
                    consoleHelper: consoleHelperSettings,
                    templatesFolder,
                    sourceFolders,
                }
            } else {
                result = {
                    consoleHelper: {
                        type: 'direct',
                        phpPath: 'php',
                        webPath: '',
                    },
                    templatesFolder,
                    sourceFolders,
                };
            }

            return result;
        });

        await service.setProjects([
            { uri: projectUri, name: path.basename(projectUri) },
            { uri: project34Uri, name: path.basename(project34Uri) },
            { uri: project28Uri, name: path.basename(project28Uri) },
            { uri: projectAnyPhpUri, name: path.basename(projectAnyPhpUri) },
        ]);
    }

    return service;
}
