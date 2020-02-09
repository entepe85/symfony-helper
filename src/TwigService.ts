import {
    CompletionItem,
    CompletionItemKind,
    Definition,
    Hover,
    InsertTextFormat,
    Location,
    MarkupKind,
    ParameterInformation,
    Position,
    Range,
    SignatureHelp,
    TextDocument,
    TextEdit,
} from 'vscode-languageserver';

import * as twig from './twig';
import * as php from './php';
import * as utils from './utils';

import {
    hoverForTwigExtension,
    PhpClass,
    Project,
    TemplateDescription,
} from './project';

// TODO: review usage of 'Project'? replace 'Project' with small interface?
// TODO: extract methods not using 'this' into functions?
// TODO: remove 'twig' prefix from methods (it was not removed during refactoring)
// preconditions for public methods:
//   * 'document' is inside of 'project'
export default class TwigService {
    public constructor(private allDocuments: utils.AllTextDocuments) {
    }

    public async complete(project: Project, document: TextDocument, position: Position): Promise<CompletionItem[]> {
        let text = document.getText();
        let offset = document.offsetAt(position);

        let parsed = twig.fullParse(text);

        let { tokens, pieces } = parsed;

        let currentTemplateName = document.uri.substr((project.templatesFolderUri + '/').length);

        let currentPiece: twig.TwigPiece | null = null;
        for (let p of pieces) {
            if (p.start <= offset && offset <= p.end) {
                currentPiece = p;
                break;
            }
        }

        if (currentPiece !== null) {
            let currentPieceToCursor = text.substring(currentPiece.start, offset);

            if (/^{%\s*end\w*\s+$/.test(currentPieceToCursor)) {
                return [];
            }

            let stringTokenContainingCursorIndex = twig.stringTokenContainingCursor(tokens, offset);

            // complete route in first argument (if it is also a string) of path() and url()
            do {
                if (stringTokenContainingCursorIndex === null) {
                    break;
                }

                let i = stringTokenContainingCursorIndex;

                if (i < 2) {
                    break;
                }

                if (tokens[i-1].type !== twig.TokenType.PUNCTUATION || twig.tokenValue(text, tokens[i-1]) !== '(') {
                    break;
                }

                if (tokens[i-2].type !== twig.TokenType.NAME) {
                    break;
                }

                if (i >= 3 && twig.tokenValue(text, tokens[i-3]) === '.') {
                    break;
                }

                let functionName = twig.tokenValue(text, tokens[i-2]);
                if (functionName !== 'path' && functionName !== 'url') {
                    break;
                }

                let stringToken = tokens[stringTokenContainingCursorIndex];

                let routes = project.getAllRoutes();

                let codeAfterCursor = text.substr(offset);

                let postfixMatch = /^([\.\w-]*)['"]\s*\)/.exec(codeAfterCursor);

                let items: CompletionItem[] = [];

                for (let row of routes) {
                    let item: CompletionItem = {
                        label: row.name,
                        kind: CompletionItemKind.Method,
                        textEdit: {
                            newText: row.name,
                            range: Range.create(document.positionAt(stringToken.offset + 1), position),
                        },
                        detail: row.path,
                        documentation: row.controller,
                    };

                    if (row.pathParams.length > 0 && (postfixMatch !== null)) {
                        let postfix = postfixMatch[1];
                        let paramsPosition = document.positionAt(offset + postfix.length + 1);
                        let paramsText = ', {' + row.pathParams.map(name => `'${name}': ''`).join(', ') + '}';
                        item.additionalTextEdits = [{
                            newText: paramsText,
                            range: Range.create(paramsPosition, paramsPosition),
                        }];
                    }

                    items.push(item);
                }
                return items;
            } while (false);

            // complete template name
            do {
                if (stringTokenContainingCursorIndex === null) {
                    break;
                }

                let data: { prefix: string; onlyWithMacros: boolean } | undefined;

                do {
                    let textToCursor = text.substr(0, offset);

                    let match;

                    match = /{%\s*(include|extends|embed|use)\s+(['"])([@!\w\./\-]*)$/.exec(textToCursor);
                    if (match !== null) {
                        data = {
                            prefix: match[3],
                            onlyWithMacros: false,
                        };
                        break;
                    }

                    match = /{%\s*(import|from)\s+(['"])([@!\w\./\-]*)$/.exec(textToCursor);
                    if (match !== null) {
                        data = {
                            prefix: match[3],
                            onlyWithMacros: true,
                        };
                        break;
                    }
                } while (false);

                if (data === undefined) {
                    break;
                }

                let items: CompletionItem[] = [];

                for (let fileUri in project.templates) {
                    let templateInfo = project.templates[fileUri];

                    if (data.onlyWithMacros && templateInfo.macros.length === 0) {
                        continue;
                    }

                    let templateName = templateInfo.name;

                    if (templateName.startsWith('bundles/')) {
                        continue;
                    }

                    // fast hack. should be improved and tested.
                    if (data.prefix.startsWith('@')) {
                        if (!templateName.startsWith('@')) {
                            continue;
                        }
                        if (!templateName.toLowerCase().includes(data.prefix.substr(1).toLowerCase())) {
                            continue;
                        }
                    } else {
                        if (templateName.startsWith('@')) {
                            continue;
                        }
                    }

                    items.push({
                        label: templateName,
                        kind: CompletionItemKind.File,
                        textEdit: {
                            range: Range.create(document.positionAt(offset - data.prefix.length), position),
                            newText: templateName,
                        },
                    });
                }

                return items;
            } while (false);

            // complete macro import in {%from%}
            do {
                let st = currentPiece.startToken;

                if (!(st + 3 < tokens.length
                        && currentPiece.type === 'block'
                        && twig.tokenValue(text, tokens[st+1]) === 'from'
                        && tokens[st+2].type === twig.TokenType.STRING
                        && twig.tokenValue(text, tokens[st+3]) === 'import')) {
                    break;
                }

                if (offset < tokens[st+3].offset + tokens[st+3].length) {
                    break;
                }

                // position confirmed. use 'return' insted of 'break'

                let templateNameRaw = twig.tokenValue(text, tokens[st+2]);
                let templateName = templateNameRaw.substr(1, templateNameRaw.length - 2);

                let definitionsTemplate = project.getTemplate(templateName);
                if (definitionsTemplate === null) {
                    return [];
                }

                let codeToCursor = text.substr(0, offset);

                if (!/(import\s+|,\s*)\w*$/.test(codeToCursor)) {
                    return [];
                }

                let result: CompletionItem[] = [];

                for (let macro of definitionsTemplate.macros) {
                    result.push({
                        label: macro.name,
                        detail: macro.definitionString,
                        documentation: macro.comment,
                        kind: CompletionItemKind.Method,
                    });
                }

                return result;
            } while (false);

            // don't complete after 'as' in {%import%}
            do {
                let st = currentPiece.startToken;

                if (!(st + 3 < tokens.length
                        && currentPiece.type === 'block'
                        && twig.tokenValue(text, tokens[st+1]) === 'import'
                        && tokens[st+2].type === twig.TokenType.STRING
                        && twig.tokenValue(text, tokens[st+3]) === 'as')) {
                    break;
                }

                if (offset >= tokens[st+3].offset) {
                    return [];
                }
            } while (false);

            // completion of constant in 'constant()' function
            do {
                let textToCursor = text.substr(0, offset);

                let match = /[^\w]constant\s*\(\s*['"]([\w\\]+)::([\w]*)$/.exec(textToCursor);
                if (match === null) {
                    break;
                }

                let rawClassName = match[1];
                let className = rawClassName.replace(/\\\\/g, '\\');
                if (className.startsWith('\\')) {
                    className = className.substr(1);
                }

                let phpClass = await project.getPhpClass(className);
                if (phpClass === null) {
                    break;
                }

                let prefix = match[2];

                let items: CompletionItem[] = [];

                for (let constant of phpClass.constants) {
                    if (!constant.isPublic) {
                        continue;
                    }

                    let item: CompletionItem = {
                        label: constant.name,
                        textEdit: {
                            newText: constant.name,
                            range: Range.create(
                                document.positionAt(offset - prefix.length),
                                document.positionAt(offset)
                            ),
                        },
                    };

                    if (constant.shortHelp !== undefined) {
                        item.documentation = constant.shortHelp;
                    }

                    items.push(item);
                }

                return items;
            } while (false);

            // completion of class in 'constant()' function
            do {
                let textToCursor = text.substr(0, offset);

                let match = /[^\w]constant\s*\(\s*['"]([\w\\]*)$/.exec(textToCursor);
                if (match === null) {
                    break;
                }

                let rawClassName = match[1];
                if (!rawClassName.includes('\\')) {
                    let items: CompletionItem[] = [];

                    let editRange = Range.create(
                        document.positionAt(offset - rawClassName.length),
                        document.positionAt(offset)
                    );

                    for (let fileUri in project.phpClasses) {
                        let phpClass = project.phpClasses[fileUri];

                        if (!phpClass.hasConstants) {
                            continue;
                        }

                        let fullClassName = phpClass.fullClassName;

                        let label;
                        if (fullClassName.includes('\\')) {
                            let fullClassNamePieces = fullClassName.split('\\');
                            label = fullClassNamePieces[fullClassNamePieces.length - 1];
                        } else {
                            label = fullClassName;
                        }

                        let newText = fullClassName.replace(/\\/g, '\\\\');

                        items.push({
                            label,
                            kind: (phpClass.type === 'class') ? CompletionItemKind.Class : CompletionItemKind.Interface,
                            textEdit: {
                                newText,
                                range: editRange,
                            },
                            detail: fullClassName,
                        });
                    }

                    return items;
                }
            } while (false);

            // show only filters after '|' and in '{% filter %}'
            {
                let tokens2 = twig.tokenize(text.substr(0, offset)); // I can use just 'text' but I am not sure that text after 'offset' will not change result of tokenization

                let index = tokens2.length - 2; // index of last not-EOF token

                let complete = false;
                let completeStartOffset: number | undefined;

                if (index >= 1 && tokens2[index-1].type === twig.TokenType.BLOCK_START
                        && tokens2[index].type === twig.TokenType.NAME
                        && text.substr(tokens2[index].offset, tokens2[index].length) === 'filter'
                        && tokens2[index].offset + tokens2[index].length < offset) {
                    // '{% filter' test
                    complete = true;
                    completeStartOffset = offset;
                } else if (index >= 2 && tokens2[index-2].type === twig.TokenType.BLOCK_START
                        && tokens2[index-1].type === twig.TokenType.NAME
                        && text.substr(tokens2[index-1].offset, tokens2[index-1].length) === 'filter'
                        && tokens2[index].type === twig.TokenType.NAME
                        && tokens2[index].offset + tokens2[index].length === offset) {
                    // '{% filter flt' test
                    complete = true;
                    completeStartOffset = tokens2[index].offset;
                } else if (tokens2[index].type === twig.TokenType.PUNCTUATION
                        && text[tokens2[index].offset] === '|') {
                    // '|' test
                    complete = true;
                    completeStartOffset = offset;
                } else if (index >= 1 && tokens2[index-1].type === twig.TokenType.PUNCTUATION
                        && text[tokens2[index-1].offset] === '|'
                        && tokens2[index].type === twig.TokenType.NAME
                        && tokens2[index].offset + tokens2[index].length === offset) {
                    // '|flt' test
                    complete = true;
                    completeStartOffset = tokens2[index].offset;
                }

                if (complete && completeStartOffset !== undefined) {
                    let items: CompletionItem[] = [];

                    let editRange = Range.create(document.positionAt(completeStartOffset), document.positionAt(offset));

                    for (let fileUri in project.phpClasses) {
                        let extensionElements = project.phpClasses[fileUri].twigExtensionElements;
                        if (extensionElements === undefined) {
                            continue;
                        }

                        for (let element of extensionElements) {
                            if (element.type === 'filter') {
                                items.push({
                                    label: element.name,
                                    kind: CompletionItemKind.Function,
                                    textEdit: {
                                        range: editRange,
                                        newText: element.name,
                                    },
                                });
                            }
                        }
                    }

                    return items;
                }
            }

            // show only tests after 'is' and 'is not'
            {
                let match = /is\s+not\s+(\w*)$/.exec(currentPieceToCursor);
                let match2 = /is\s+(\w*)$/.exec(currentPieceToCursor);
                if (match !== null || match2 !== null) {
                    let prefix = '';
                    if (match !== null) {
                        prefix = match[1];
                    } else if (match2 !== null) {
                        prefix = match2[1];
                    }

                    let editRange = Range.create(
                        position.line,
                        position.character - prefix.length,
                        position.line,
                        position.character
                    );

                    let items: CompletionItem[] = [];

                    for (let fileUri in project.phpClasses) {
                        let extensionElements = project.phpClasses[fileUri].twigExtensionElements;
                        if (extensionElements === undefined) {
                            continue;
                        }

                        for (let element of extensionElements) {
                            if (element.type === 'test') {
                                items.push({
                                    label: element.name,
                                    kind: CompletionItemKind.Function,
                                    textEdit: {
                                        range: editRange,
                                        newText: element.name,
                                    },
                                });
                            }
                        }
                    }

                    return items;
                }
            }

            // complete only block names in {% block %}
            do {
                let match = /^{%\s*block\s+(\w*)$/.exec(currentPieceToCursor);
                if (match === null) {
                    break;
                }

                let prefix = match[1];

                let template = project.templates[document.uri];
                if (template === undefined || template.extends === undefined) {
                    break;
                }

                let blocks = project.collectAllTemplateBlocks(template.extends);
                let items: CompletionItem[] = [];
                for (let blockName in blocks) {
                    let data = blocks[blockName];
                    let blockTemplates = data.map(row => row.templateName).reverse();

                    items.push({
                        label: blockName,
                        kind: CompletionItemKind.Text,
                        textEdit: {
                            newText: blockName,
                            range: Range.create(document.positionAt(offset - prefix.length), position),
                        },
                        detail: 'from ' + blockTemplates.join(', '),
                    });
                }

                return items;

            } while (false);

            // complete in {% autoescape %}
            do {
                let match = /^{%\s*autoescape\s+(('|")?\w*)$/.exec(currentPieceToCursor);
                if (match === null) {
                    break;
                }

                let strategies = ['html', 'js', 'css', 'url', 'html_attr'];

                let prefix = match[1];
                let quote = match[2];

                let detail = 'for {% autoescape %}';

                let items: CompletionItem[] = [];

                if (quote === undefined) {
                    let editRange = Range.create(document.positionAt(offset - prefix.length), document.positionAt(offset));

                    items.push({
                        label: 'false',
                        detail,
                        textEdit: {
                            newText: 'false',
                            range: editRange,
                        },
                    });

                    for (let s of strategies) {
                        let label = `'${s}'`;

                        items.push({
                            label,
                            detail,
                            textEdit: {
                                newText: label,
                                range: editRange,
                            },
                        });
                    }
                } else {
                    let editRange = Range.create(document.positionAt(offset - prefix.length + 1), document.positionAt(offset));

                    for (let s of strategies) {
                        items.push({
                            label: s,
                            detail,
                            textEdit: {
                                newText: s,
                                range: editRange,
                            },
                        });
                    }
                }

                return items;
            } while (false);

            // complete macro call after alias of imported file
            do {
                let match = /((\w+)\.)(\w*)$/.exec(currentPieceToCursor);
                if (match === null) {
                    break;
                }

                // should not be '.' before alias
                if (currentPieceToCursor[currentPieceToCursor.length - 1 - match[0].length] === '.') {
                    break;
                }

                let alias = match[2];
                let prefix = match[3];

                let fileMacroImports = twig.twigFileMacroImports(parsed);
                if (fileMacroImports[alias] === undefined) {
                    break;
                }

                let macroTemplateInfo = project.getTemplate(fileMacroImports[alias]);
                if (macroTemplateInfo === null) {
                    break;
                }

                let items: CompletionItem[] = [];

                let editRange = Range.create(document.positionAt(offset - prefix.length), document.positionAt(offset));

                for (let macro of macroTemplateInfo.macros) {
                    items.push({
                        label: macro.name,
                        detail: macro.definitionString,
                        documentation: macro.comment,
                        textEdit: {
                            newText: macro.name,
                            range: editRange,
                        },
                    });
                }

                return items;
            } while (false);

            // complete variables after '.'
            do {
                if (stringTokenContainingCursorIndex !== null) {
                    break;
                }

                let textToCursor = text.substr(0, offset);
                let prefixMatch = /\.([\w]*)$/.exec(textToCursor);
                if (prefixMatch === null) {
                    break;
                }

                let prefix = prefixMatch[1];

                let prefixDotOffset = prefixMatch.index;
                if (prefixDotOffset === undefined) {
                    break;
                }

                let prefixDotTokenIndex: number | undefined;
                for (let i = 0; i < tokens.length; i++) {
                    if (tokens[i].offset === prefixDotOffset && tokens[i].type === twig.TokenType.PUNCTUATION) {
                        prefixDotTokenIndex = i;
                        break;
                    }
                }

                if (prefixDotTokenIndex === undefined) {
                    break;
                }

                let editRange = Range.create(document.positionAt(offset - prefix.length), document.positionAt(offset));

                // new method of completion after dot
                let initialScope = new twig.Scope();
                let params = await project.collectRenderCallsParams(currentTemplateName);
                initialScope.setValue('app', new php.ObjectType('Symfony\\Bridge\\Twig\\AppVariable'));
                for (let name in params) {
                    initialScope.setValue(name, params[name]);
                }

                let { dots } = await twig.findExpressionData(
                    parsed,
                    initialScope,
                    (className: string) => project.getPhpClass(className),
                    (name: string) => project.twigFunctionReturnType(name)
                );

                if (dots[prefixDotTokenIndex] === undefined) {
                    break;
                }
                let typeBeforeDot = dots[prefixDotTokenIndex].typeBefore;
                if (typeBeforeDot instanceof php.ObjectType) {
                    let className = typeBeforeDot.getClassName();

                    let phpClass = await project.getPhpClass(className);
                    if (phpClass === null) {
                        break;
                    }

                    return this.twigCompletionsForClass(project, phpClass, editRange);
                } else if (typeBeforeDot instanceof php.ArrayType) {
                    let knownValues = typeBeforeDot.getKnownValues();

                    if (knownValues !== undefined) {
                        let items: CompletionItem[] = [];

                        for (let fieldName in knownValues) {
                            items.push({
                                label: fieldName,
                                textEdit: {
                                    newText: fieldName,
                                    range: editRange,
                                },
                            });
                        }

                        return items;
                    }
                }
            } while (false);

            // complete variables and functions
            do {
                if (stringTokenContainingCursorIndex !== null) {
                    break;
                }

                return this.completeVariableOrFunctionInTemplate(project, document, position, parsed);
            } while (false);

            return [];
        } else {
            // complete route name in <a href="">
            do {
                let textToCursor = text.substring(0, offset);
                let match = /[^\w]href="([\w-]*)$/.exec(textToCursor);
                if (match === null) {
                    break;
                }

                let prefix = match[1];

                let routes = project.getAllRoutes();

                let items: CompletionItem[] = [];
                for (let row of routes) {
                    let insertTextFormat: InsertTextFormat;
                    let newText: string;

                    if (row.pathParams.length > 0) {
                        let params = row.pathParams;

                        let paramsPieces: string[] = [];
                        for (let i = 0; i < params.length; i++) {
                            paramsPieces.push(`'${params[i]}': $${i+1}`);
                        }

                        insertTextFormat = InsertTextFormat.Snippet;
                        newText = `{{ path('${row.name}', { ${paramsPieces.join(', ')} }) }}`;
                    } else {
                        insertTextFormat = InsertTextFormat.PlainText;
                        newText = `{{ path('${row.name}') }}`;
                    }

                    let item: CompletionItem = {
                        label: row.name,
                        kind: CompletionItemKind.Method,
                        textEdit: {
                            newText: newText,
                            range: Range.create(
                                document.positionAt(offset - prefix.length),
                                position
                            ),
                        },
                        detail: row.path,
                        documentation: row.controller,
                        insertTextFormat: insertTextFormat,
                    };

                    items.push(item);
                }

                return items;
            } while (false);

            return this.completeTags(document, position, parsed);
        }
    }

    private completeTags(document: TextDocument, position: Position, parsed: twig.ParsedTwig): CompletionItem[] {
        let { code, pieces, stmts } = parsed;

        let items: CompletionItem[] = [];

        let offset = document.offsetAt(position);

        for (let piece of pieces) {
            if (piece.start < offset && offset < piece.end) {
                return items;
            }
        }

        let codeToCursor = code.substr(0, offset);
        let match = /(\w+)$/.exec(codeToCursor);
        let prefix = (match !== null) ? match[1] : '';
        let range = Range.create(
            document.positionAt(offset - prefix.length),
            position
        );

        let data: { label: string; macro: string; filterText?: string; additionalTextEdit?: TextEdit }[] = [
            {
                label: 'autoescape',
                macro: '{% autoescape $1 %}\n\t$0\n{% endautoescape %}'
            },
            {
                label: 'block',
                macro: '{% block $1 %}\n\t$0\n{% endblock %}',
            },
            {
                label: 'block "..."',
                filterText: 'block',
                macro: '{% block $1 "$2" %}',
            },
            {
                label: 'deprecated',
                macro: '{% deprecated "$1" %}',
            },
            {
                label: 'do',
                macro: '{% do $1 %}',
            },
            {
                label: 'embed',
                macro: '{% embed "$1" %}\n\t$0\n{% endembed %}',
            },
            {
                label: 'extends',
                macro: '{% extends "$1" %}',
            },
            {
                label: 'filter',
                macro: '{% filter $1 %}\n\t$0\n{% endfilter %}',
            },
            {
                label: 'flush',
                macro: '{% flush %}',
            },
            {
                label: 'for',
                macro: '{% for $1 in $2 %}\n\t$0\n{% endfor %}',
            },
            {
                label: 'if',
                macro: '{% if $1 %}\n\t$0\n{% endif %}',
            },
            {
                label: 'include',
                macro: '{% include "$1" %}',
            },
            {
                label: 'macro',
                macro: '{% macro $1($2) %}\n\t$0\n{% endmacro %}',
            },
            {
                label: 'sandbox',
                macro: '{% sandbox %}\n\t$0\n{% endsandbox %}',
            },
            {
                label: 'set',
                macro: '{% set $1 = $2 %}',
            },
            {
                label: 'set ... %endset',
                filterText: 'set',
                macro: '{% set $1 %}\n\t$0\n{% endset %}'
            },
            {
                label: 'spaceless',
                macro: '{% spaceless %}\n\t$0\n{% endspaceless %}',
            },
            {
                label: 'use',
                macro: '{% use "$1" %}',
            },
            {
                label: 'verbatim',
                macro: '{% verbatim %}\n\t$0\n{% endverbatim %}',
            },
            {
                label: 'with',
                macro: '{% with %}\n\t$0\n{% endwith %}',
            },
            {
                label: 'with {}',
                filterText: 'with',
                macro: '{% with { $1 } %}\n\t$0\n{% endwith %}',
            },
            {
                label: 'import',
                macro: '{% import \'$1\' as $2 %}',
            },
            {
                label: 'from ... import',
                filterText: 'from import',
                macro: '{% from \'$1\' import $2 as $3 %}',
            },
        ];

        let deepestStmt = twig.deepestStatement(stmts, offset, pieces, false);
        if (deepestStmt !== null) {
            let moreData: { label: string; macro: string; additionalTextEdit?: TextEdit }[] = [];

            let startPieceIndex: number | undefined;

            if (deepestStmt.type === 'if') {
                moreData.push({
                    label: 'else',
                    macro: '{% else %}\n\t',
                }, {
                    label: 'elseif',
                    macro: '{% elseif $1 %}\n\t',
                }, {
                    label: 'endif',
                    macro: '{% endif %}\n',
                });

                startPieceIndex = deepestStmt.startPiece;

            } else if (deepestStmt.type === 'for') {
                moreData.push({
                    label: 'else',
                    macro: '{% else %}\n\t',
                }, {
                    label: 'endfor',
                    macro: '{% endfor %}\n',
                });

                startPieceIndex = deepestStmt.startPiece;

            } else if (twig.typesOfSimplestStatementWithStatements.includes(deepestStmt.type)) {
                moreData.push({
                    label: 'end' + deepestStmt.type,
                    macro: '{% end' + deepestStmt.type + ' %}\n',
                });

                startPieceIndex = (deepestStmt as twig.SimplestStatementWithStatements).startPiece;
            }

            if (startPieceIndex !== undefined) {
                let startPiece = pieces[startPieceIndex];

                let codeToStartPiece = code.substr(0, startPiece.start);
                let lastNewLineBeforeStartPieceIndex = codeToStartPiece.lastIndexOf('\n');

                let lastNewLineBeforeCursor = codeToCursor.lastIndexOf('\n');

                if (lastNewLineBeforeStartPieceIndex > 0 && lastNewLineBeforeCursor > 0) {
                    let startPiecePrefix = codeToStartPiece.substr(lastNewLineBeforeStartPieceIndex + 1);

                    let prefixBeforePrefix = code.substring(lastNewLineBeforeCursor + 1, offset - prefix.length);

                    if (/^\s*$/.test(prefixBeforePrefix)) {
                        for (let row of moreData) {
                            row.additionalTextEdit = {
                                newText: startPiecePrefix,
                                range: Range.create(
                                    document.positionAt(lastNewLineBeforeCursor + 1),
                                    document.positionAt(offset - prefix.length)
                                ),
                            };
                        }
                    }
                }
            }

            data.push(...moreData);
        }

        for (let { label, macro, filterText, additionalTextEdit } of data) {
            let item: CompletionItem = {
                label: '%' + label,
                filterText: (filterText === undefined) ? label : filterText,
                textEdit: {
                    range,
                    newText: macro,
                },
                insertTextFormat: InsertTextFormat.Snippet,
                kind: CompletionItemKind.Snippet,
            };

            if (additionalTextEdit !== undefined) {
                item.additionalTextEdits = [additionalTextEdit];
            }

            items.push(item);
        }

        items.push({
            label: '{{ ...|raw }}',
            filterText: 'raw',
            textEdit: {
                range,
                newText: '{{ $1|raw }}',
            },
            insertTextFormat: InsertTextFormat.Snippet,
            kind: CompletionItemKind.Snippet,
        });

        return items;
    }

    private async twigCompletionsForClass(project: Project, phpClass: PhpClass, editRange: Range): Promise<CompletionItem[]> {
        let items: CompletionItem[] = [];

        for (let property of phpClass.properties) {
            if (property.isPublic) {
                items.push({
                    label: property.name,
                    textEdit: {
                        newText: property.name,
                        range: editRange,
                    }
                });
            }
        }

        for (let method of phpClass.methods) {
            if (method.isPublic) {
                // hide methods 'set*()'
                if (method.name.startsWith('set') && method.name.length > 3 && method.name[3].toUpperCase() === method.name[3]) {
                    continue;
                }

                if (method.name.startsWith('__')) {
                    continue;
                }

                let label: string;

                if ((method.name.startsWith('get') || method.name.startsWith('has')) && method.name.length > 3) {
                    label = method.name.substr(3);
                    label = label[0].toLowerCase() + label.substr(1);
                } else if (method.name.startsWith('is') && method.name.length > 2) {
                    label = method.name.substr(2);
                    label = label[0].toLowerCase() + label.substr(1);
                } else {
                    label = method.name;
                }

                let item: CompletionItem = {
                    label,
                    textEdit: {
                        newText: label,
                        range: editRange,
                    },
                };

                // it's a hack. I should test method body for used fields.
                if (phpClass.entity !== undefined) {
                    let field = phpClass.entity.fields.find(row => row.name === label);
                    if (field !== undefined) {
                        item.detail = field.type;

                        let doc = await project.phpClassHoverMarkdown(phpClass.fullClassName, 'property', field.name);
                        if (doc !== null) {
                            item.documentation = {
                                kind: MarkupKind.Markdown,
                                value: doc,
                            };
                        }
                    }
                }

                items.push(item);
            }
        }

        return items;
    }

    private async completeVariableOrFunctionInTemplate(project: Project, document: TextDocument, position: Position, parsed: twig.ParsedTwig): Promise<CompletionItem[]> {
        let { code, pieces } = parsed;

        let items: CompletionItem[] = [];

        let templateName = document.uri.substr((project.templatesFolderUri + '/').length);

        let offset = document.offsetAt(position);

        if (code[offset - 1] === '.') {
            return items;
        }

        let activeTwigPiece;
        for (let piece of pieces) {
            if (piece.start < offset && offset < piece.end) {
                activeTwigPiece = piece;
            }
        }

        if (activeTwigPiece === undefined) {
            return items;
        }

        let identifierLeft = '';
        let twigPieceLeft = code.substring(activeTwigPiece.start, offset);
        let leftMatch = /(\w+)$/.exec(twigPieceLeft);
        if (leftMatch !== null) {
            identifierLeft = leftMatch[1];
        }

        let editRange = Range.create(position.line, position.character - identifierLeft.length, position.line, position.character);

        // collecting parameters from 'render()' and 'renderView()'
        {
            let preItems: { [name: string]: CompletionItem } = Object.create(null);
            let counts: { [name: string]: number } = Object.create(null);

            for (let fileUri in project.phpClasses) {
                let renderCalls = project.phpClasses[fileUri].templateRenderCalls;
                if (renderCalls === undefined) {
                    continue;
                }

                for (let renderCall of renderCalls) {
                    if (renderCall.name === templateName) {
                        for (let param of renderCall.params) {
                            let name = param.name;

                            if (preItems[name] === undefined) {
                                preItems[name] = {
                                    label: name,
                                    kind: CompletionItemKind.Variable,
                                    textEdit: {
                                        range: editRange,
                                        newText: name,
                                    },
                                };
                            }

                            if (counts[name] === undefined) {
                                counts[name] = 1;
                            } else {
                                counts[name] += 1;
                            }
                        }
                    }
                }
            }

            for (let name in preItems) {
                let item = preItems[name];
                item.detail = (counts[name] === 1) ? '1 call' : `${counts[name]} calls`;
                items.push(item);
            }
        }

        // collecting functions from twig extensions
        for (let fileUri in project.phpClasses) {
            let extensionElements = project.phpClasses[fileUri].twigExtensionElements;
            if (extensionElements === undefined) {
                continue;
            }

            for (let element of extensionElements) {
                if (element.type === 'function') {
                    items.push({
                        label: element.name,
                        kind: CompletionItemKind.Function,
                        textEdit: {
                            range: editRange,
                            newText: element.name,
                        },
                    });
                }
            }
        }

        // globals from 'twig.yaml'
        for (let name of project.twigYamlGlobals()) {
            items.push({
                label: name,
                kind: CompletionItemKind.Variable,
                textEdit: {
                    range: editRange,
                    newText: name,
                },
                detail: 'twig.yaml',
            });
        }

        // collecting globals from twig extensions
        for (let fileUri in project.phpClasses) {
            let phpClass = project.phpClasses[fileUri];
            if (phpClass.twigExtensionGlobals !== undefined) {
                for (let row of phpClass.twigExtensionGlobals) {
                    items.push({
                        label: row.name,
                        kind: CompletionItemKind.Variable,
                        textEdit: {
                            range: editRange,
                            newText: row.name,
                        },
                        detail: fileUri.substr(project.getFolderUri().length + 1),
                    });
                }
            }
        }

        {
            let initialScope = new twig.Scope();
            let variables = await twig.findVariables(
                parsed,
                offset,
                initialScope,
                (className: string) => project.getPhpClass(className),
                (name: string) => project.twigFunctionReturnType(name)
            );
            if (variables !== undefined) {
                for (let name in variables) {
                    items.push({
                        label: name,
                        kind: CompletionItemKind.Variable,
                        textEdit: {
                            range: editRange,
                            newText: name,
                        },
                    });
                }
            }
        }

        // local aliases for macro file imports
        {
            let fileMacroImports = twig.twigFileMacroImports(parsed);

            for (let alias in fileMacroImports) {
                let macrosTemplateName = fileMacroImports[alias];

                let templateInfo = project.getTemplate(macrosTemplateName);

                if (templateInfo === null) {
                    continue;
                }

                let documentaionPieces: string[] = [];
                for (let m of templateInfo.macros) {
                    documentaionPieces.push(m.definitionString);
                }

                items.push({
                    label: alias,
                    detail: `macros '${macrosTemplateName}'`,
                    documentation: documentaionPieces.join('\n'),
                });
            }
        }

        // macro imports from {%from%}
        {
            let macroImports = twig.twigMacroImports(parsed);

            for (let alias in macroImports) {
                let { macroName, templateName: macroTemplateName } = macroImports[alias];

                let templateInfo = project.getTemplate(macroTemplateName);
                if (templateInfo === null) {
                    continue;
                }

                let macro = templateInfo.macros.find(row => row.name === macroName);
                if (macro === undefined) {
                    continue;
                }

                let documentation = `from '${macroTemplateName}'`;
                if (macro.comment !== undefined) {
                    documentation += '\n\n' + macro.comment;
                }

                items.push({
                    label: alias,
                    detail: macro.definitionString,
                    documentation,
                });
            }
        }

        items.push({
            label: 'app',
            kind: CompletionItemKind.Variable,
            textEdit: {
                range: editRange,
                newText: 'app',
            },
        });

        return items;
    }

    public async definition(project: Project, document: TextDocument, position: Position): Promise<Definition | null> {
        let template = project.templates[document.uri];
        if (template === undefined) {
            return null;
        }

        let code = document.getText();
        let offset = document.offsetAt(position);

        let parsed = twig.fullParse(code);
        let { tokens, pieces } = parsed;

        let cursorPiece: twig.TwigPiece | null = null;
        for (let p of pieces) {
            if (p.start <= offset && offset <= p.end) {
                cursorPiece = p;
                break;
            }
        }

        if (cursorPiece === null) {
            return null;
        }

        // test name of {% block %}
        {
            let result = this.twigTestBlockName(project, code, tokens, template, offset);

            if (result !== null) {
                let locations: Location[] = [];

                for (let definition of result.definitions) {
                    if (definition.templateName === template.name) {
                        continue;
                    }

                    let templateInfo = project.getTemplate(definition.templateName);
                    if (templateInfo === null) {
                        continue;
                    }

                    let definitionDocument = await this.getDocument(templateInfo.fileUri);
                    if (definitionDocument === null) {
                        continue;
                    }

                    let definitionPosition = definitionDocument.positionAt(definition.offset);

                    locations.push({
                        uri: templateInfo.fileUri,
                        range: Range.create(definitionPosition, definitionPosition),
                    });
                }

                locations.reverse();

                return locations;
            }
        }

        // test route in 'path()' or 'url()'
        {
            let result = this.twigTestRouteName(code, tokens, offset);

            if (result !== null) {
                let controllerLocation = await project.routeLocation(result.route);
                if (controllerLocation !== null) {
                    return controllerLocation;
                }
            }
        }

        // test argument of 'constant()'
        {
            let result = this.twigTestConstantFunction(code, tokens, offset);

            if (result !== null) {
                if (result.constantName === undefined) {
                    return project.phpClassLocation(result.className);
                } else {
                    return project.phpClassLocation(result.className, 'constant', result.constantName);
                }
            }
        }

        // test template name
        {
            let result = this.twigTestTemplateName(code, tokens, offset);

            if (result !== null) {
                if (result.startsWith('@')) {
                    let match = /^@!?(\w+)\//.exec(result);
                    if (match !== null) {
                        let bundleName = match[1];
                        let bundleInfo = project.getBundleInfo(bundleName + 'Bundle');
                        if (bundleInfo !== null) {
                            let templateName = result.substr(match[0].length);

                            let locations: Location[] = [];

                            if (result[1] !== '!') {
                                let overridePath = '/templates/bundles/' + bundleName + 'Bundle/' + templateName;
                                if (await utils.fileExists(project.getFolderPath() + overridePath)) {
                                    locations.push({
                                        uri: project.getFolderUri() + overridePath,
                                        range: Range.create(0, 0, 0, 0),
                                    });
                                }
                            }

                            locations.push({
                                uri: bundleInfo.folderUri + '/Resources/views/' + templateName,
                                range: Range.create(0, 0, 0, 0),
                            });

                            return locations;
                        }
                    }
                }

                return {
                    uri: project.templatesFolderUri + '/' + result,
                    range: Range.create(0, 0, 0, 0),
                };
            }
        }

        // test '{%from%} for imported macros' and 'macro calls'
        {
            let result = this.twigTestMacroImport(parsed, offset);

            if (result === null) {
                result = this.twigTestMacroCall(parsed, offset);
            }

            if (result !== null) {
                let { templateName, macroName } = result;

                let macroTemplate = project.getTemplate(templateName);

                if (macroTemplate !== null) {
                    let macro = macroTemplate.macros.find(row => row.name === macroName);
                    let templateDocument = await this.getDocument(project.templatesFolderUri + '/' + macroTemplate.name);

                    if (macro !== undefined && templateDocument !== null) {
                        let macroPosition = templateDocument.positionAt(macro.offset);

                        return {
                            uri: templateDocument.uri,
                            range: Range.create(macroPosition, macroPosition),
                        };
                    }
                }
            }
        }

        // tests for variables and functions
        {
            let result = project.twigTestObject(document.uri, parsed, offset);

            if (result !== null) {
                if (result.type === 'function') {
                    let extensionDocument = await this.getDocument(result.fileUri);

                    if (extensionDocument !== null) {
                        let elementPosition: Position;

                        if (result.element.implementation !== undefined) {
                            elementPosition = extensionDocument.positionAt(result.element.implementation.offset);
                        } else {
                            elementPosition = extensionDocument.positionAt(result.element.constructorOffset);
                        }

                        return {
                            uri: result.fileUri,
                            range: Range.create(elementPosition, elementPosition),
                        };
                    }
                } else if (result.type === 'renderParams') {
                    let locations: Location[] = [];

                    for (let row of result.params) {
                        let callerDocument = await this.getDocument(row.callerFileUri);

                        if (callerDocument !== null) {
                            let paramPosition = callerDocument.positionAt(row.paramOffset);

                            locations.push({
                                uri: row.callerFileUri,
                                range: Range.create(paramPosition, paramPosition)
                            });
                        }
                    }

                    return locations;

                } else if (result.type === 'global') {
                    let twigYamlDocument = await this.getDocument(result.fileUri);

                    if (twigYamlDocument !== null) {
                        let globalPosition = twigYamlDocument.positionAt(result.offset);

                        return {
                            uri: result.fileUri,
                            range: Range.create(globalPosition, globalPosition),
                        };
                    }
                } else if (result.type === 'macroFileImport') {
                    return {
                        uri: project.templatesFolderUri + '/' + result.templateName,
                        range: Range.create(0, 0, 0, 0),
                    };
                }
            }
        }

        // new way of testing variables and functions
        do {
            let nameTokenUnderCursorIndex = twig.tokenUnderCursor(tokens, twig.TokenType.NAME, offset);
            if (nameTokenUnderCursorIndex === null) {
                break;
            }

            let initialScope = new twig.Scope();

            let params = await project.collectRenderCallsParams(template.name);
            for (let name in params) {
                initialScope.setValue(name, params[name]);
            }

            let expressionData = await twig.findExpressionData(
                parsed,
                initialScope,
                (className: string) => project.getPhpClass(className),
                (name: string) => project.twigFunctionReturnType(name)
            );

            let nameTokenInfo = expressionData.names[nameTokenUnderCursorIndex];
            if (nameTokenInfo === undefined) {
                break;
            }

            if (nameTokenInfo.type === 'classMethod') {
                // it looks like a hack
                let propName: string | undefined;
                if (nameTokenInfo.methodName.startsWith('get') || nameTokenInfo.methodName.startsWith('has')) {
                    propName = nameTokenInfo.methodName.substr(3);
                } else if (nameTokenInfo.methodName.startsWith('is')) {
                    propName = nameTokenInfo.methodName.substr(2);
                }
                if (propName !== undefined && propName.length > 0) {
                    propName = propName[0].toLowerCase() + propName.substr(1);

                    let loc = await project.phpClassLocation(nameTokenInfo.className, 'property', propName);
                    if (loc !== null) {
                        return loc;
                    }
                }

                return project.phpClassLocation(nameTokenInfo.className, 'method', nameTokenInfo.methodName);
            } else if (nameTokenInfo.type === 'classProperty') {
                return project.phpClassLocation(nameTokenInfo.className, 'property', nameTokenInfo.propertyName);
            }
        } while (false);

        return null;
    }

    public async hover(project: Project, document: TextDocument, position: Position): Promise<Hover | null> {
        let template = project.templates[document.uri];
        if (template === undefined) {
            return null;
        }

        let code = document.getText();
        let offset = document.offsetAt(position);

        let parsed = twig.fullParse(code);

        let { tokens, pieces } = parsed;

        let cursorPiece: twig.TwigPiece | null = null;
        for (let p of pieces) {
            if (p.start <= offset && offset <= p.end) {
                cursorPiece = p;
                break;
            }
        }

        if (cursorPiece === null) {
            return null;
        }

        // test name of {% block %}
        {
            let result = this.twigTestBlockName(project, code, tokens, template, offset);

            if (result !== null) {
                let blockDefinitions = result.definitions;

                let hoverValuePieces = ['```'];

                for (let i = 0; i < blockDefinitions.length; i++) {
                    let definition = blockDefinitions[blockDefinitions.length - 1 - i];
                    if (i === 0) {
                        hoverValuePieces.push('defined in ' + definition.templateName);
                    } else {
                        hoverValuePieces.push('used in ' + definition.templateName);
                    }
                }

                hoverValuePieces.push('```');

                return {
                    contents: {
                        value: hoverValuePieces.join('\n'),
                        kind: MarkupKind.Markdown,
                    },
                    range: Range.create(
                        document.positionAt(result.hoverLeftOffset),
                        document.positionAt(result.hoverRightOffset)
                    ),
                };
            }
        }

        // test route in 'path()' or 'url()'
        {
            let result = this.twigTestRouteName(code, tokens, offset);

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
                        ),
                    };
                }
            }
        }

        // test argument of 'constant()'
        {
            let result = this.twigTestConstantFunction(code, tokens, offset);

            if (result !== null) {
                let hoverMarkdown: string | null = null;

                if (result.constantName === undefined) {
                    hoverMarkdown = await project.phpClassHoverMarkdown(result.className);
                } else {
                    hoverMarkdown = await project.phpClassHoverMarkdown(result.className, 'constant', result.constantName);
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

        {
            let result = this.twigTestMacroImport(parsed, offset);

            if (result === null) {
                result = this.twigTestMacroCall(parsed, offset);
            }

            if (result !== null) {
                let { templateName, macroName } = result;

                let macroTemplate = project.getTemplate(templateName);

                if (macroTemplate !== null) {
                    let macro = macroTemplate.macros.find(row => row.name === macroName);

                    if (macro !== undefined) {
                        let markdownPieces = ['```'];
                        if (macro.comment !== undefined) {
                            markdownPieces.push(macro.comment);
                            markdownPieces.push('');
                        }
                        markdownPieces.push(macro.definitionString);
                        markdownPieces.push('```');

                        return {
                            contents: {
                                kind: MarkupKind.Markdown,
                                value: markdownPieces.join('\n'),
                            },
                            range: Range.create(
                                document.positionAt(result.hoverLeftOffset),
                                document.positionAt(result.hoverRightOffset)
                            )
                        };
                    }
                }
            }
        }

        // tests for variables and functions
        {
            let result = project.twigTestObject(document.uri, parsed, offset);

            if (result !== null) {
                if (result.type === 'function') {
                    let { element, fileUri } = result;

                    let extensionFilePath = fileUri.substr((project.getFolderUri()+'/').length);

                    let hoverValue = hoverForTwigExtension(element, extensionFilePath);

                    return {
                        contents: {
                            kind: MarkupKind.Markdown,
                            value: hoverValue,
                        },
                        range: Range.create(
                            document.positionAt(result.hoverLeftOffset),
                            document.positionAt(result.hoverRightOffset)
                        )
                    };
                } else if (result.type === 'renderParams') {
                    let markdownPieces = ['```', 'render parameter'];

                    for (let param of result.params) {
                        markdownPieces.push(param.className + '#' + param.methodName);
                    }

                    markdownPieces.push('```');

                    return {
                        contents: {
                            kind: MarkupKind.Markdown,
                            value: markdownPieces.join('\n'),
                        },
                        range: Range.create(
                            document.positionAt(result.hoverLeftOffset),
                            document.positionAt(result.hoverRightOffset)
                        )
                    };
                } else if (result.type === 'global') {
                    let markdownPieces = ['```'];

                    let value = result.value;
                    if (value !== undefined && !(value.includes('\n') || value.includes('\r'))) {
                        markdownPieces.push(`${result.name} = ${value}`);
                    }

                    let relativePath = result.fileUri.substr(project.getFolderUri().length);
                    markdownPieces.push(`from '${relativePath}'`);

                    markdownPieces.push('```');

                    return {
                        contents: {
                            kind: MarkupKind.Markdown,
                            value: markdownPieces.join('\n'),
                        },
                        range: Range.create(
                            document.positionAt(result.hoverLeftOffset),
                            document.positionAt(result.hoverRightOffset)
                        )
                    };
                } else if (result.type === 'macroFileImport') {
                    let markdownPieces = [
                        '```',
                        `macro collection '${result.templateName}'`,
                        '```',
                    ];

                    return {
                        contents: {
                            kind: MarkupKind.Markdown,
                            value: markdownPieces.join('\n'),
                        },
                        range: Range.create(
                            document.positionAt(result.hoverLeftOffset),
                            document.positionAt(result.hoverRightOffset)
                        )
                    };
                }
            }
        }

        // new way of testing variables and functions
        do {
            let nameTokenUnderCursorIndex = twig.tokenUnderCursor(tokens, twig.TokenType.NAME, offset);
            if (nameTokenUnderCursorIndex === null) {
                break;
            }

            let initialScope = new twig.Scope();

            let params = await project.collectRenderCallsParams(template.name);
            for (let name in params) {
                initialScope.setValue(name, params[name]);
            }

            let expressionData = await twig.findExpressionData(
                parsed,
                initialScope,
                (className: string) => project.getPhpClass(className),
                (name: string) => project.twigFunctionReturnType(name)
            );

            let nameTokenInfo = expressionData.names[nameTokenUnderCursorIndex];
            if (nameTokenInfo === undefined) {
                break;
            }

            let nameToken = tokens[nameTokenUnderCursorIndex];
            let hoverMarkdown: string | null = null;

            if (nameTokenInfo.type === 'classMethod') {
                // it's a hack. I should test body of method for used field
                let propName: string | undefined;
                if (nameTokenInfo.methodName.startsWith('get') || nameTokenInfo.methodName.startsWith('has')) {
                    propName = nameTokenInfo.methodName.substr(3);
                } else if (nameTokenInfo.methodName.startsWith('is')) {
                    propName = nameTokenInfo.methodName.substr(2);
                }
                if (propName !== undefined && propName.length > 0) {
                    propName = propName[0].toLowerCase() + propName.substr(1);
                    hoverMarkdown = await project.phpClassHoverMarkdown(nameTokenInfo.className, 'property', propName);
                }

                if (hoverMarkdown === null) {
                    hoverMarkdown = await project.phpClassHoverMarkdown(nameTokenInfo.className, 'method', nameTokenInfo.methodName);
                }
            } else if (nameTokenInfo.type === 'classProperty') {
                hoverMarkdown = await project.phpClassHoverMarkdown(nameTokenInfo.className, 'property', nameTokenInfo.propertyName);
            }

            if (hoverMarkdown !== null) {
                return {
                    contents: {
                        kind: MarkupKind.Markdown,
                        value: hoverMarkdown,
                    },
                    range: Range.create(
                        document.positionAt(nameToken.offset),
                        document.positionAt(nameToken.offset + nameToken.length)
                    )
                };
            }
        } while (false);

        return null;
    }

    public async signature(project: Project, document: TextDocument, position: Position): Promise<SignatureHelp | null> {
        let template = project.templates[document.uri];
        if (template === undefined) {
            return null;
        }

        let currentTemplateName = document.uri.substr((project.templatesFolderUri + '/').length);

        let code = document.getText();
        let offset = document.offsetAt(position);

        let parsed = twig.fullParse(code);
        let { tokens, pieces } = parsed;

        let cursorPiece: twig.TwigPiece | null = null;
        for (let p of pieces) {
            if (p.start <= offset && offset <= p.end) {
                cursorPiece = p;
                break;
            }
        }

        if (cursorPiece === null) {
            return null;
        }

        // stack of real calls (with 'nameIndex') and parenthesis of arithmetic expressions
        let stack: { nameTokenIndex?: number; argPosition: number }[] = [];

        for (let i = cursorPiece.startToken; i <= cursorPiece.endToken; i++) {
            if (tokens[i].offset >= offset) {
                break;
            }

            let tokenValue = twig.tokenValue(code, tokens[i]);

            if (tokenValue === '(') {
                stack.push({ argPosition: 0 });
                if (i - 1 >= cursorPiece.startToken && tokens[i-1].type === twig.TokenType.NAME) {
                    stack[stack.length - 1].nameTokenIndex = i - 1;
                }
                continue;
            }

            if (tokenValue === ')') {
                if (stack.length > 0) {
                    stack.pop();
                }
                continue;
            }

            if (tokenValue === ',') {
                stack[stack.length - 1].argPosition += 1;
            }
        }

        let lastCall: { nameTokenIndex: number; argPosition: number } | undefined;
        for (let i = stack.length - 1; i >= 0; i--) {
            let t = stack[i];
            if (t.nameTokenIndex !== undefined) {
                lastCall = { nameTokenIndex: t.nameTokenIndex, argPosition: t.argPosition };
                break;
            }
        }

        if (lastCall === undefined) {
            return null;
        }

        // first test macro calls
        do {
            let macroTestResult = this.twigTestMacroCall(parsed, tokens[lastCall.nameTokenIndex].offset);
            if (macroTestResult === null) {
                break;
            }

            let { templateName, macroName } = macroTestResult;

            let macroTemplate = project.getTemplate(templateName);
            if (macroTemplate === null) {
                break;
            }

            let macro = macroTemplate.macros.find(row => row.name === macroName);
            if (macro === undefined) {
                break;
            }

            let signatureLabel = macroName + '(';

            let macroArgs = macro.arguments;
            let signatureParams: ParameterInformation[] = [];
            for (let i = 0; i < macroArgs.length; i++) {
                let { name: argName } = macroArgs[i];
                signatureParams.push({label: [signatureLabel.length, signatureLabel.length + argName.length]});
                signatureLabel += argName + ((i === macroArgs.length - 1) ? '' : ', ');
            }
            signatureLabel += ')';

            let signatureHelp = {
                activeSignature: 0,
                activeParameter: lastCall.argPosition,
                signatures: [
                    {
                        label: signatureLabel,
                        parameters: signatureParams,
                    },
                ],
            };

            return signatureHelp;
        } while (false);

        if (lastCall.nameTokenIndex > cursorPiece.start) {
            if (twig.tokenValue(code, tokens[lastCall.nameTokenIndex - 1]) === '.') {
                return null;
            }
        }

        let tokenTestResult = project.twigTestObject(document.uri, parsed, tokens[lastCall.nameTokenIndex].offset);

        if (tokenTestResult !== null) {
            if (tokenTestResult.type === 'function') {
                let twigExtensionElement = tokenTestResult.element;

                if (twigExtensionElement.implementation === undefined) {
                    return null;
                }

                let signatureLabel = twigExtensionElement.name + '(';

                let extensionParams = twigExtensionElement.implementation.params;
                let signatureParams: ParameterInformation[] = [];
                for (let i = 0; i < extensionParams.length; i++) {
                    let { name: paramName } = extensionParams[i];
                    signatureParams.push({label: [signatureLabel.length, signatureLabel.length + paramName.length]});
                    signatureLabel += paramName + ((i === extensionParams.length - 1) ? '' : ', ');
                }
                signatureLabel += ')';

                let result = {
                    activeSignature: 0,
                    activeParameter: lastCall.argPosition,
                    signatures: [
                        {
                            label: signatureLabel,
                            parameters: signatureParams,
                        },
                    ],
                };

                return result;
            }
        }

        let initialScope = new twig.Scope();
        let params = await project.collectRenderCallsParams(currentTemplateName);
        initialScope.setValue('app', new php.ObjectType('Symfony\\Bridge\\Twig\\AppVariable'));
        for (let name in params) {
            initialScope.setValue(name, params[name]);
        }

        let { names } = await twig.findExpressionData(
            parsed,
            initialScope,
            (className: string) => project.getPhpClass(className),
            (name: string) => project.twigFunctionReturnType(name)
        );

        if (names[lastCall.nameTokenIndex] !== undefined) {
            let nameInfo = names[lastCall.nameTokenIndex];
            if (nameInfo.type === 'classMethod') {
                let signatureLabel = nameInfo.methodName + '(';
                let methodName = nameInfo.methodName;

                let phpClass = await project.getPhpClass(nameInfo.className);
                if (phpClass !== null) {
                    let method = phpClass.methods.find(row => (row.isPublic && row.name === methodName));
                    if (method !== undefined) {
                        let signatureParams: ParameterInformation[] = [];

                        for (let i = 0; i < method.params.length; i++) {
                            let p = method.params[i];

                            signatureParams.push({ label: [signatureLabel.length, signatureLabel.length + p.name.length] });
                            signatureLabel += p.name + ((i === method.params.length - 1) ? '' : ', ');
                        }

                        signatureLabel += ')';

                        let result = {
                            activeSignature: 0,
                            activeParameter: lastCall.argPosition,
                            signatures: [
                                {
                                    label: signatureLabel,
                                    parameters: signatureParams,
                                },
                            ],
                        };

                        return result;
                    }
                }
            }
        }

        return null;
    }

    /**
     * Search for name of '{% block %}'
     */
    private twigTestBlockName(project: Project, code: string, tokens: ReadonlyArray<twig.Token>, template: TemplateDescription, offset: number) {
        let tokenIndex = twig.tokenUnderCursor(tokens, twig.TokenType.NAME, offset);
        let i = tokenIndex;

        if (i === null || i < 2) {
            return null;
        }

        if (twig.tokenValue(code, tokens[i-1]) !== 'block') {
            return null;
        }

        if (tokens[i-2].type !== twig.TokenType.BLOCK_START) {
            return null;
        }

        if (template.extends === undefined) {
            return null;
        }

        let nameToken = tokens[i];
        let blockName = twig.tokenValue(code, nameToken);

        let foundBlocks = this.findBlockDefinitions(project, template.extends, blockName);

        return {
            name: blockName,
            hoverLeftOffset: nameToken.offset,
            hoverRightOffset: nameToken.offset + nameToken.length,
            definitions: foundBlocks,
        };
    }

    /**
     * Finds definitions of block for given template
     */
    private findBlockDefinitions(project: Project, templateName: string, blockName: string) {
        let result: { templateName: string; offset: number }[] = [];

        let currentTemplateName: string | undefined = templateName;

        for (let i = 0; i < 19; i++ /* protection from infinite cycle */) {
            if (currentTemplateName === undefined) {
                break;
            }

            let currentTemplate = project.getTemplate(currentTemplateName);
            if (currentTemplate === null) {
                break;
            }

            for (let block of currentTemplate.blocks) {
                if (block.name === blockName) {
                    result.push({
                        templateName: currentTemplateName,
                        offset: block.offset,
                    });
                }
            }

            if (currentTemplate.extends === undefined) {
                break;
            }

            currentTemplateName = currentTemplate.extends;
        }

        return result;
    }

    private twigTestRouteName(code: string, tokens: ReadonlyArray<twig.Token>, offset: number) {
        let tokenIndex = twig.tokenUnderCursor(tokens, twig.TokenType.STRING, offset);
        let i = tokenIndex;

        if (i === null || i <= 2) {
            return null;
        }

        if (twig.tokenValue(code, tokens[i-1]) !== '(') {
            return null;
        }

        let prevPrevTokenvValue = twig.tokenValue(code, tokens[i-2]);
        if (!['path', 'url'].includes(prevPrevTokenvValue)) {
            return null;
        }

        let routeName = code.substr(tokens[i].offset + 1, tokens[i].length - 2);

        return {
            route: routeName,
            hoverLeftOffset: tokens[i].offset,
            hoverRightOffset: tokens[i].offset + tokens[i].length,
        };
    }

    private twigTestConstantFunction(code: string, tokens: ReadonlyArray<twig.Token>, offset: number) {
        let tokenIndex = twig.stringTokenContainingCursor(tokens, offset);
        let i = tokenIndex;

        if (i === null || i <= 2) {
            return null;
        }

        if (twig.tokenValue(code, tokens[i-1]) !== '(') {
            return null;
        }

        if (twig.tokenValue(code, tokens[i-2]) !== 'constant') {
            return null;
        }

        let token = tokens[i];

        let rawValue = code.substr(token.offset + 1, token.length - 2);

        let regexp = /^([\w\\]+)(:|::(\w+)?)?$/;
        let match = regexp.exec(rawValue);
        if (match === null) {
            return null;
        }

        let rawClassName = match[1];
        let rawConstantName = match[3];

        let rawClassNameLeftOffset = token.offset + 1;
        let rawClassNameRightOffset = rawClassNameLeftOffset + rawClassName.length;

        let className = rawClassName.replace(/\\\\/g, '\\');
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

        if (rawConstantName !== undefined) {
            let constantName = rawConstantName;
            let rawConstantNameLeftOffset = rawClassNameRightOffset + 2;
            let rawConstantNameRightOffset = rawConstantNameLeftOffset + rawConstantName.length;

            if (rawConstantNameLeftOffset <= offset && offset <= rawConstantNameRightOffset) {
                return {
                    className,
                    constantName,
                    hoverLeftOffset: rawConstantNameLeftOffset,
                    hoverRightOffset: rawConstantNameRightOffset,
                };
            }
        }

        return null;
    }

    private twigTestTemplateName(code: string, tokens: ReadonlyArray<twig.Token>, offset: number): string | null {
        let tokenIndex = twig.tokenUnderCursor(tokens, twig.TokenType.STRING, offset);
        let i = tokenIndex;

        if (i === null) {
            return null;
        }

        let token = tokens[i];

        let value = code.substr(token.offset + 1, token.length - 2);

        if (value.endsWith('.twig')) {
            return value;
        }

        return null;
    }

    /**
     * Search for imported macro name in {%from%}
     */
    private twigTestMacroImport(parsed: twig.ParsedTwig, offset: number) {
        let { code, tokens, pieces } = parsed;

        let piece: twig.TwigPiece | undefined;

        for (let p of pieces) {
            if (p.start <= offset && offset <= p.end) {
                piece = p;
                break;
            }
        }

        if (piece === undefined) {
            return null;
        }

        let ti = piece.startToken;

        if (!(ti + 3 < tokens.length
                && piece.type === 'block'
                && twig.tokenValue(code, tokens[ti+1]) === 'from'
                && tokens[ti+2].type === twig.TokenType.STRING
                && twig.tokenValue(code, tokens[ti+3]) === 'import')) {
            return null;
        }

        let nameTokenUnderCursor: { token: twig.Token; index: number } | undefined;
        for (let i = ti + 4; i <= piece.endToken; i++)  {
            let t = tokens[i];
            if (t.type === twig.TokenType.NAME && t.offset <= offset && offset <= t.offset + t.length) {
                nameTokenUnderCursor = { token: t, index: i };
                break;
            }
        }

        if (nameTokenUnderCursor === undefined) {
            return null;
        }

        let prevTokenValue = twig.tokenValue(code, tokens[nameTokenUnderCursor.index - 1]);
        if (prevTokenValue !== 'import' && prevTokenValue !== ',') {
            return null;
        }

        let templateName = twig.tokenValue(code, tokens[ti+2]);
        templateName = templateName.substr(1, templateName.length - 2);

        const nameToken = nameTokenUnderCursor.token;
        return {
            templateName,
            macroName: twig.tokenValue(code, nameToken),
            hoverLeftOffset: nameToken.offset,
            hoverRightOffset: nameToken.offset + nameToken.length,
        };
    }


    private twigTestMacroCall(parsed: twig.ParsedTwig, offset: number) {
        let { code, tokens, pieces } = parsed;

        let cursorTokenIndex = twig.tokenUnderCursor(tokens, twig.TokenType.NAME, offset);
        if (cursorTokenIndex === null) {
            return null;
        }

        let piece: twig.TwigPiece | undefined;

        for (let p of pieces) {
            if (p.start <= offset && offset <= p.end) {
                piece = p;
                break;
            }
        }

        if (piece === undefined) {
            return null;
        }

        let st = piece.startToken;

        if (st + 1 < tokens.length
                && piece.type === 'block'
                && twig.tokenValue(code, tokens[st+1]) === 'from') {
            return null;
        }

        let fileMacroImports = twig.twigFileMacroImports(parsed);
        let macroImports = twig.twigMacroImports(parsed);

        let cursorToken = tokens[cursorTokenIndex];
        let cursorTokenText = twig.tokenValue(code, cursorToken);

        let prevTokenText = twig.tokenValue(code, tokens[cursorTokenIndex - 1]);
        if (prevTokenText === '.') {
            do {
                if (cursorTokenIndex <= 1) {
                    break;
                }

                let prevPrevToken = tokens[cursorTokenIndex - 2];
                if (prevPrevToken.type !== twig.TokenType.NAME) {
                    break;
                }

                if (cursorTokenIndex >= 3) {
                    let prevPrevPrevTokenText = twig.tokenValue(code, tokens[cursorTokenIndex - 3]);
                    if (prevPrevPrevTokenText === '.') {
                        break;
                    }
                }

                let alias = twig.tokenValue(code, prevPrevToken);
                if (fileMacroImports[alias] === undefined) {
                    break;
                }

                let templateName = fileMacroImports[alias];

                return {
                    macroName: cursorTokenText,
                    templateName,
                    hoverLeftOffset: cursorToken.offset,
                    hoverRightOffset: cursorToken.offset + cursorToken.length,
                };

            } while (false);
        } else {
            if (macroImports[cursorTokenText] !== undefined) {
                let data = macroImports[cursorTokenText];
                return {
                    macroName: data.macroName,
                    templateName: data.templateName,
                    hoverLeftOffset: cursorToken.offset,
                    hoverRightOffset: cursorToken.offset + cursorToken.length,
                };
            }
        }

        return null;
    }

    private async getDocument(uri: string): Promise<TextDocument | null> {
        return this.allDocuments.get(uri);
    }
}
