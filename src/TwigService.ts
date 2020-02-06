import {
    CompletionItem,
    CompletionItemKind,
    InsertTextFormat,
    MarkupKind,
    Position,
    Range,
    TextDocument,
    TextEdit,
} from 'vscode-languageserver';

import * as twig from './twig';
import * as php from './php';

import {
    PhpClass,
    Project,
} from './project';

// TODO: review usage of 'Project'? replace 'Project' with small interface?
export default class TwigService {
    // preconditions:
    //   * 'document' is inside of 'project'
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

    private async twigCompletionsForClass(project: Project, phpClass: PhpClass, editRange: Range) {
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

                // TODO: test 'phpClass.entity !== undefined' everywhere

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

        // collecting globals from 'twig.yaml'
        if (project.twigYaml !== undefined) {
            for (let global of project.twigYaml.globals) {
                items.push({
                    label: global.name,
                    kind: CompletionItemKind.Variable,
                    textEdit: {
                        range: editRange,
                        newText: global.name,
                    },
                    detail: 'twig.yaml',
                });
            }
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
}
