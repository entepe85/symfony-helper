import * as sax from 'sax';

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

// preconditions for public methods:
//   * 'document' is inside of 'project'
export default class XmlService {
    public constructor(private allDocuments: utils.AllTextDocuments) {
    }

    public async definition(project: Project, document: TextDocument, position: Position): Promise<Definition | null> {
        let offset = document.offsetAt(position);

        // jump to php class from 'class' or class-like 'id' of <service>
        {
            let result = this.testServiceClassOrId(project, document, offset);

            if (result !== null) {
                return project.phpClassLocation(result.className);
            }
        }

        // jump to service definition from 'alias' of <service>
        {
            let result = this.testServiceAlias(project, document, offset);

            if (result !== null) {
                let { aliasedService } = result;

                let serviceDocument = await this.getDocument(aliasedService.fileUri);

                if (serviceDocument !== null) {
                    let serviceDefinitionPosition = serviceDocument.positionAt(aliasedService.tagStartOffset);

                    return {
                        uri: aliasedService.fileUri,
                        range: Range.create(serviceDefinitionPosition, serviceDefinitionPosition),
                    };
                }
            }
        }

        // jump to service definition from 'id' of <argument type="service">
        {
            let result = this.testArgumentId(project, document.getText(), offset);

            if (result !== null) {
                let { description } = result;

                let xmlDocument = await this.getDocument(description.fileUri);

                if (xmlDocument !== null) {
                    let tagPosition = xmlDocument.positionAt(description.tagStartOffset);

                    return {
                        uri: description.fileUri,
                        range: Range.create(tagPosition, tagPosition),
                    };
                }
            }
        }

        return null;
    }

    public async hover(project: Project, document: TextDocument, position: Position): Promise<Hover | null> {
        let offset = document.offsetAt(position);

        // hover over 'class' or class-like 'id' of <service>
        {
            let result = this.testServiceClassOrId(project, document, offset);

            if (result !== null) {
                let hoverMarkdown = await project.phpClassHoverMarkdown(result.className);

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

        // hover over 'alias' value of <service>
        {
            let result = this.testServiceAlias(project, document, offset);

            if (result !== null) {
                return {
                    range: Range.create(
                        document.positionAt(result.hoverLeftOffset),
                        document.positionAt(result.hoverRightOffset)
                    ),
                    contents: {
                        kind: MarkupKind.Markdown,
                        value: project.serviceHoverMarkdown(result.aliasedService),
                    }
                };
            }
        }

        // hover over 'id' of <argument type="service">
        {
            let result = this.testArgumentId(project, document.getText(), offset);

            if (result !== null) {
                let hoverMarkdown = project.serviceHoverMarkdown(result.description);

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

        return null;
    }

    /**
     * Test 'class' and 'id' attribute of <service>
     */
    private testServiceClassOrId(project: Project, document: TextDocument, offset: number) {
        let classRegexp = /class="([\w\\]+)"/;
        let classlikeIdRegexp = /id="([\w\\]+)"/;

        let description = project.findServiceDescription(document.uri, offset);
        if (description === null) {
            return null;
        }

        let tagString = document.getText().substring(description.tagStartOffset, description.tagEndOffset);

        let className;
        let matchIndex;
        let prefixLength;

        // first test 'class', then 'id'
        let classMatch = classRegexp.exec(tagString);
        if (classMatch !== null && classMatch.index !== undefined) {
            className = classMatch[1];
            matchIndex = classMatch.index;
            prefixLength = 'class="'.length;
        } else {
            let idMatch = classlikeIdRegexp.exec(tagString);
            if (idMatch !== null && idMatch.index !== undefined) {
                className = idMatch[1];
                matchIndex = idMatch.index;
                prefixLength = 'id="'.length;
            } else {
                return null;
            }
        }

        let classNameOffset = description.tagStartOffset + matchIndex + prefixLength;
        let hoverLeftOffset = classNameOffset;
        let hoverRightOffset = classNameOffset + className.length;

        if (!(hoverLeftOffset <= offset && offset <= hoverRightOffset)) {
            return null;
        }

        return { className, hoverLeftOffset, hoverRightOffset };
    }


    /**
     * Test 'id' attribute of <argument>
     */
    private testArgumentId(project: Project, code: string, offset: number) {
        let idRegexp = /id="([\w\.\\]+)"/;

        let parser = sax.parser(true, { position: true });

        let data: { serviceId: string; leftOffset: number; rightOffset: number } | undefined;

        parser.onopentag = (tag): void => {
            // answer is found already
            if (data !== undefined) {
                return;
            }

            if (tag.name !== 'argument') {
                return;
            }

            if (typeof tag.attributes.id !== 'string' || typeof tag.attributes.type !== 'string') {
                return;
            }

            if (tag.attributes.type !== 'service') {
                return;
            }

            let tagEnd = parser.position;
            let tagStart = code.lastIndexOf('<argument ', tagEnd);
            if (tagStart < 0) {
                return;
            }

            if (!(tagStart <= offset && offset <= tagEnd)) {
                return;
            }

            let tagText = code.substring(tagStart, tagEnd);

            let idMatch = idRegexp.exec(tagText);
            if (idMatch === null || idMatch.index === undefined) {
                return;
            }

            let serviceId = idMatch[1];
            let idValueOffset = tagStart + idMatch.index + 'id="'.length;

            if (!(idValueOffset <= offset && offset <= idValueOffset + serviceId.length)) {
                return;
            }

            data = { serviceId, leftOffset: idValueOffset, rightOffset: idValueOffset + serviceId.length };
        };

        parser.write(code).close();

        if (data === undefined) {
            return null;
        }

        let description = project.getService(data.serviceId);

        if (description === undefined) {
            return null;
        }

        return {
            description,
            hoverLeftOffset: data.leftOffset,
            hoverRightOffset: data.rightOffset,
        };
    }

    /**
     * Test 'alias' attribute of <service>
     */
    private testServiceAlias(project: Project, document: TextDocument, offset: number) {
        let aliasRegexp = /alias="([\w\.]+)"/;

        let description = project.findServiceDescription(document.uri, offset);
        if (description === null) {
            return null;
        }

        let tagString = document.getText().substring(description.tagStartOffset, description.tagEndOffset);

        let aliasMatch = aliasRegexp.exec(tagString);
        if (aliasMatch === null || aliasMatch.index === undefined) {
            return null;
        }

        let serviceId = aliasMatch[1];

        let aliasedService = project.getService(serviceId);
        if (aliasedService === undefined) {
            return null;
        }

        let aliasValueOffset = description.tagStartOffset + aliasMatch.index + 'alias="'.length;
        let hoverLeftOffset = aliasValueOffset;
        let hoverRightOffset = aliasValueOffset + serviceId.length;

        if (!(hoverLeftOffset <= offset && offset <= hoverRightOffset)) {
            return null;
        }

        return { aliasedService, hoverLeftOffset, hoverRightOffset };
    }

    private async getDocument(uri: string): Promise<TextDocument | null> {
        return this.allDocuments.get(uri);
    }
}
