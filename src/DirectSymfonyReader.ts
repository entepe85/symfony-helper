import * as path from 'path';

import {
    exec,
    packagePath,
    requestHttpCommandsHelper,
    SymfonyHelperSettingsResolver,
} from './utils';

type RoutesMap = Map< /* name */ string, { path: string; pathParams: string[]; controller: string }>;

type ServiceDescription = { fullClassName: string; serviceId?: string };

type RouteCollection = {
    name: string;
    path: string;
    pathParams: string[];
    controller: string;
}[];

/**
 * Returns names of params of route path
 */
function parseSymfonyRoutePath(routePath: string): string[] {
    let params: string[] = [];

    // I don't need to parse stuff like '{name<\d+?1>}' by myself because 'debug:router' does it for me
    let regexp = /{(\w+)}/g;

    let match;
    do {
        match = regexp.exec(routePath);
        if (match !== null) {
            params.push(match[1]);
        }
    } while (match !== null);

    return params;
}

/**
 * Reads AND caches some data directly from the 'symfony-commands.php'
 *
 * scan*()-methods are for scanning
 * get*()-methods are for getting cached data
 *
 * I think that splitting this class into class for each individual data isn't worth it
 */
export default class DirectSymfonyReader {
    private routes: RoutesMap = new Map();

    private autowiredServices: ServiceDescription[] = [];

    private containerParameters: { [name: string]: any } = Object.create(null);

    private doctrineEntityNamespaces: { [alias: string]: string } = Object.create(null);

    public constructor(private settingsResolver: SymfonyHelperSettingsResolver, private projectPath: string) {
    }

    public async scanRoutes(): Promise<void> {
        let settings = await this.settingsResolver();

        if (settings === null) {
            return;
        }

        let routesRaw = null;

        if (settings.consoleHelper.type === 'direct') {
            routesRaw = await exec(
                settings.consoleHelper.phpPath,
                [path.join(packagePath, 'php-bin/symfony-commands.php'), this.projectPath, 'directCommand', 'getRoutes']
            );
        } else if (settings.consoleHelper.type === 'http') {
            routesRaw = await requestHttpCommandsHelper(settings.consoleHelper.webPath, 'directCommand', 'getRoutes');
        } else {
            throw new Error('unexpected "settings.consoleHelper.type"');
        }

        let routes = JSON.parse(routesRaw);

        let newRoutes: RoutesMap = new Map;

        for (let name in routes) {
            if (name.startsWith('_')) {
                continue;
            }

            let routePath = routes[name].path;

            let params = parseSymfonyRoutePath(routePath);

            newRoutes.set(name, {
                path: routePath,
                controller: routes[name].defaults._controller,
                pathParams: params,
            });
        }

        this.routes = newRoutes;
    }

    public getRoute(name: string): { path: string; controller: string } | undefined {
        return this.routes.get(name);
    }

    public getAllRoutes(): RouteCollection {
        let result = [];

        for (let row of this.routes) {
            result.push({
                name: row[0],
                path: row[1].path,
                pathParams: row[1].pathParams,
                controller: row[1].controller,
            });
        }

        return result;
    }

    public async scanAutowiredServices(): Promise<void> {
        let settings = await this.settingsResolver();

        if (settings === null) {
            return;
        }

        let responseRaw;

        if (settings.consoleHelper.type === 'direct') {
            responseRaw = await exec(
                settings.consoleHelper.phpPath,
                [path.join(packagePath, 'php-bin/symfony-commands.php'), this.projectPath, 'directCommand', 'getAutowiredServices']
            );
        } else if (settings.consoleHelper.type === 'http') {
            responseRaw = await requestHttpCommandsHelper(settings.consoleHelper.webPath, 'directCommand', 'getAutowiredServices');
        } else {
            throw new Error('unexpected "settings.consoleHelper.type"');
        }

        let autowiredServices = [];

        let regexp = /^\s*([\w\\]+)\s+\(([\w\.]+)\)/;
        let regexp2 = /^\s*([\w\\]+)\s*$/;
        let lines = responseRaw.split('\n');

        for (let line of lines) {
            let match2 = regexp2.exec(line);
            if (match2 !== null) {
                let fullClassName = match2[1];
                if (fullClassName.includes('\\')) {
                    autowiredServices.push({ fullClassName });
                }
            } else {
                let match = regexp.exec(line);
                if (match !== null) {
                    let fullClassName = match[1];
                    let serviceId = match[2];
                    autowiredServices.push({ fullClassName, serviceId });
                }
            }
        }

        this.autowiredServices = autowiredServices;
    }

    public getAllAutowiredServices(): ReadonlyArray<ServiceDescription> {
        return this.autowiredServices;
    }

    public async scanContainerParameters(): Promise<void> {
        let settings = await this.settingsResolver();
        if (settings === null) {
            return;
        }

        let parametersRaw = null;

        if (settings.consoleHelper.type === 'direct') {
            parametersRaw = await exec(
                settings.consoleHelper.phpPath,
                [path.join(packagePath, 'php-bin/symfony-commands.php'), this.projectPath, 'directCommand', 'getParameters']
            );
        } else if (settings.consoleHelper.type === 'http') {
            parametersRaw = await requestHttpCommandsHelper(settings.consoleHelper.webPath, 'directCommand', 'getParameters');
        } else {
            throw new Error('unexpected "settings.consoleHelper.type"');
        }

        // why response is not clean json?
        if (!parametersRaw.trim().endsWith('}')) {
            let jsonEndIndex = parametersRaw.lastIndexOf('}');
            if (jsonEndIndex > 0) {
                parametersRaw = parametersRaw.substr(0, jsonEndIndex + 1);
            }
        }

        let parameters = JSON.parse(parametersRaw);

        this.containerParameters = parameters;
    }

    public getAllContainerParameters(): { [name: string]: any } {
        return this.containerParameters;
    }

    public getContainerParameter(name: string): any {
        return this.containerParameters[name];
    }

    public async scanDoctrineEntityNamespaces(): Promise<void> {
        let settings = await this.settingsResolver();
        if (settings === null) {
            return;
        }

        let responseRaw: any;

        if (settings.consoleHelper.type === 'direct') {
            responseRaw = await exec(
                settings.consoleHelper.phpPath,
                [path.join(packagePath, 'php-bin/symfony-commands.php'), this.projectPath, 'otherCommand', 'getEntityNamespaces']
            );
        } else if (settings.consoleHelper.type === 'http') {
            responseRaw = await requestHttpCommandsHelper(settings.consoleHelper.webPath, 'otherCommand', 'getEntityNamespaces');
        } else {
            throw new Error('unexpected "settings.consoleHelper.type"');
        }

        let response = JSON.parse(responseRaw);

        if (response && response.result === 'success') {
            this.doctrineEntityNamespaces = response.data;
        }
    }

    public getAllDoctrineEntitynamespaces(): { [alias: string]: string } {
        return this.doctrineEntityNamespaces;
    }
}
