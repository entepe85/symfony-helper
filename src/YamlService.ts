import * as yaml from 'yaml-ast-parser';

import {
    Definition,
    Hover,
    MarkupKind,
    Position,
    Range,
    TextDocument,
} from 'vscode-languageserver';

import * as utils from './utils';

import {
    Project,
} from './project';

/**
 * Searches for scalar in map of maps at certain offset
 */
function findYamlScalarOnSecondLevel(node: yaml.YAMLNode, key: string, offset: number): yaml.YAMLScalar | null {
    if (node.kind !== yaml.Kind.MAP) {
        return null;
    }

    for (let topNode of node.mappings) {
        if (!(topNode.key && topNode.key.kind === yaml.Kind.SCALAR)) {
            continue;
        }

        if (!(topNode.value && topNode.value.kind === yaml.Kind.MAP)) {
            continue;
        }

        for (let subNode of topNode.value.mappings) {
            if (subNode.key && subNode.key.kind === yaml.Kind.SCALAR && subNode.key.value === key) {
                if (subNode.value && subNode.value.kind === yaml.Kind.SCALAR) {
                    if (subNode.value.startPosition <= offset && offset <= subNode.value.endPosition) {
                        return subNode.value;
                    }
                }
            }
        }
    }

    return null;
}

// preconditions for public methods:
//   * 'document' is inside of 'project'
export default class YamlService {
    public constructor(private allDocuments: utils.AllTextDocuments) {
    }

    public async definition(project: Project, document: TextDocument, position: Position): Promise<Definition | null> {
        let documentUri = document.uri;
        let offset = document.offsetAt(position);
        let code = document.getText();
        let node = yaml.safeLoad(code);

        let isYamlRoutingFile = documentUri === project.getFolderUri() + '/config/routes.yaml'
            || (documentUri.startsWith(project.getFolderUri() + '/config/routes/') && documentUri.endsWith('.yaml'));

        if (!isYamlRoutingFile) {
            return null;
        }

        // jump to controller from 'routes.yaml'
        {
            let result = this.yamlTestRoutingController(code, node, offset);

            if (result !== null) {
                if (result.methodName === undefined) {
                    return project.phpClassLocation(result.className);
                } else {
                    return project.phpClassLocation(result.className, 'method', result.methodName);
                }
            }
        }

        // jump to routing resource in bundle
        {
            let result = this.yamlTestRoutingResource(project, node, offset);

            if (result !== null) {
                return {
                    uri: result,
                    range: Range.create(0, 0, 0, 0),
                };
            }
        }

        return null;
    }

    public async hover(project: Project, document: TextDocument, position: Position): Promise<Hover | null> {
        let documentUri = document.uri;
        let offset = document.offsetAt(position);
        let code = document.getText();
        let node = yaml.safeLoad(code);

        let isYamlRoutingFile = documentUri === project.getFolderUri() + '/config/routes.yaml'
            || (documentUri.startsWith(project.getFolderUri() + '/config/routes/') && documentUri.endsWith('.yaml'));

        if (!isYamlRoutingFile) {
            return null;
        }

        // hover over controller from 'routes.yaml'
        {
            let result = this.yamlTestRoutingController(code, node, offset);

            if (result !== null) {
                let hoverMarkdown: string | null = null;

                if (result.methodName === undefined) {
                    hoverMarkdown = await project.phpClassHoverMarkdown(result.className);
                } else {
                    hoverMarkdown = await project.phpClassHoverMarkdown(result.className, 'method', result.methodName);
                }

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

    private yamlTestRoutingController(code: string, node: yaml.YAMLNode, offset: number) {
        let controllerScalar = findYamlScalarOnSecondLevel(node, 'controller', offset);
        if (controllerScalar === null) {
            return null;
        }

        let rawValue = code.substring(controllerScalar.startPosition, controllerScalar.endPosition);

        let isQuotes = rawValue.startsWith("'") || rawValue.startsWith('"');
        let isDoubleQuotes = rawValue.startsWith('"');

        if (isQuotes) {
            if (offset === controllerScalar.startPosition || offset === controllerScalar.endPosition) {
                return null;
            }
        }

        let rawValueWithoutQuotes = isQuotes ? rawValue.substr(1, rawValue.length - 2) : rawValue;

        let match = /^([\w\\]+)(:|::(\w+)?)?$/.exec(rawValueWithoutQuotes);
        if (match === null) {
            return null;
        }

        let rawClassName = match[1];
        let rawMethodName = match[3];

        let rawClassNameLeftOffset = controllerScalar.startPosition + (isQuotes ? 1 : 0);
        let rawClassNameRightOffset = rawClassNameLeftOffset + rawClassName.length;

        let className = rawClassName;
        if (isDoubleQuotes) {
            className = className.replace(/\\\\/g, '\\');
        }
        if (className.startsWith('\\')) {
            className = className.substr(1);
        }

        if (rawClassNameLeftOffset <= offset && offset <= rawClassNameRightOffset) {
            return {
                className,
                hoverLeftOffset: rawClassNameLeftOffset,
                hoverRightOffset: rawClassNameRightOffset,
            };
        }

        if (rawMethodName !== undefined) {
            let methodName = rawMethodName;
            let rawMethodNameLeftOffset = rawClassNameRightOffset + 2;
            let rawMethodNameRightOffset = rawMethodNameLeftOffset + rawMethodName.length;

            if (rawMethodNameLeftOffset <= offset && offset <= rawMethodNameRightOffset) {
                return {
                    className,
                    methodName,
                    hoverLeftOffset: rawMethodNameLeftOffset,
                    hoverRightOffset: rawMethodNameRightOffset,
                };
            }
        }

        return null;
    }

    private yamlTestRoutingResource(project: Project, node: yaml.YAMLNode, offset: number): string | null {
        let resourceScalar = findYamlScalarOnSecondLevel(node, 'resource', offset);
        if (resourceScalar === null) {
            return null;
        }

        let value = resourceScalar.value;

        let match = /^@(\w*)(\/[\w/\.]*)$/.exec(value);
        if (match === null) {
            return null;
        }

        let bundleName = match[1];
        let resourcePath = match[2];

        let bundle = project.getBundleInfo(bundleName);
        if (bundle === null) {
            return null;
        }

        let resourceUri = bundle.folderUri + resourcePath;

        return resourceUri;
    }
}
