/**
 * This file is part of the 'Symfony Helper'
 * Copyright (c) 2019 Timur Morduhai
 * Licensed under the GNU General Public License
 */
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'yaml-ast-parser';
import URI from 'vscode-uri';
import * as sax from 'sax';

import {
    Range,
    Location,
    TextDocument,
    ReferenceParams,
} from 'vscode-languageserver';

import {
    tokenize as tokenizeTwig,
    TokenType as TwigTokenType,
    tokenUnderCursor as twigTokenUnderCursor,
    tokenValue as twigTokenValue,
    Token as TwigToken,
    findTwigPieces,
    twigFileMacroImports,
    macroArguments,
    findExpressionData,
    Scope,
    tokenUnderCursor,
    fullParse as twigFullParse,
    ParsedTwig,
} from './twig';

import * as php from './php';
import * as nikic from './nikic-php-parser';

import {
    readFile,
    findFiles,
    AllTextDocuments,
    parsePhpDocBlock,
    fileExists,
    sqlSelectFields,
    SymfonyHelperSettings,
    ParsedDocBlock,
    throttle
} from './utils';

import * as dql from './dql';
import DirectSymfonyReader, { RouteCollection, ServiceDescription } from './DirectSymfonyReader';

// render call of twig template in php file
export interface TemplateRenderCall {
    callerUri: string;
    className: string;
    methodName: string;
    name: string; // name of template
    params: {
        name: string;
        offset: number;
        // TODO: remove 'valueNode' and 'methonNode' and find them in parse tree?
        valueNode: nikic.Expression;
        methodNode: nikic.Stmt_ClassMethod;
    }[];
}

export interface TwigExtensionCallable {
    type: 'function' | 'test' | 'filter';
    name: string;
    nameStartOffset: number;
    nameEndOffset: number;
    constructorOffset: number;
    implementation?: {
        offset: number; // offset in file
        params: { name: string }[]; // params with removed first param for filters and tests
        help?: string;
        returnType: php.Type;
    };
}

export interface TwigExtensionGlobal {
    type: 'global';
    name: string;
    nameStartOffset: number;
    nameEndOffset: number;
}

/**
 * Finds types of method parameters
 */
function methodParamsSymbolTable(method: nikic.Stmt_ClassMethod, nameResolverData: nikic.NameResolverData): PlainSymbolTable {
    let params = method.params;
    let symbols: PlainSymbolTable = Object.create(null);

    for (let param of params) {
        if (typeof param.var.name !== 'string') {
            continue;
        }
        let name = param.var.name;

        if (param.type === null) {
            symbols[name] = new php.AnyType();
        } else if (param.type.nodeType === 'Name') {
            symbols[name] = new php.ObjectType(nikic.resolveName(param.type.parts, nameResolverData));
        } else if (param.type.nodeType === 'Name_FullyQualified') {
            symbols[name] = new php.ObjectType(param.type.parts.join('\\'));
        } else {
            symbols[name] = new php.AnyType();
        }
    }

    return symbols;
}

export function findTwigGlobalsInYaml(code: string)  {
    let node = yaml.safeLoad(code);
    if (node.kind !== yaml.Kind.MAP) {
        return [];
    }

    let twigNode: yaml.YAMLNode | undefined;
    for (let c of node.mappings) {
        if (c.key && c.key.kind === yaml.Kind.SCALAR && c.key.value === 'twig') {
            twigNode = c.value;
        }
    }
    if (twigNode === undefined || twigNode.kind !== yaml.Kind.MAP) {
        return [];
    }

    let globalsNode: yaml.YAMLNode | undefined;
    for (let c of twigNode.mappings) {
        if (c.key && c.key.kind === yaml.Kind.SCALAR && c.key.value === 'globals') {
            globalsNode = c.value;
        }
    }
    if (globalsNode === undefined || globalsNode.kind !== yaml.Kind.MAP) {
        return [];
    }

    let result: { name: string; offset: number; value: string }[] = [];

    for (let c of globalsNode.mappings) {
        if (c.key && c.key.kind === yaml.Kind.SCALAR) {
            result.push({
                name: c.key.value,
                offset: c.key.startPosition,
                value: code.substring(c.value.startPosition, c.value.endPosition),
            });
        }
    }

    return result;
}

export interface PhpClass {
    fullClassName: string; // full class name (not starting with '\')
    fileUri: string;
    offset: number; // start of class definition
    nameStartOffset: number;
    nameEndOffset: number;
    type: 'class' | 'interface';
    hasConstants: boolean;
    stmts: nikic.Statement[];
    entity?: EntityData;
    entityRepository?: { entityFullClassName: string };
    templateRenderCalls?: TemplateRenderCall[];
    twigExtensionElements?: TwigExtensionCallable[];
    twigExtensionGlobals?: TwigExtensionGlobal[];
    bundle?: { name: string; folderUri: string };
    parsedDqlQueries?: { literalOffset: number; tokens: dql.Token[] }[];
    shortHelp?: string;
    constants: php.PhpClassConstant[];
    properties: php.PhpClassProperty[];
    methods: php.PhpClassMethod[];
}

interface PlainSymbolTable {
    [varName: string ]: php.Type;
}

/**
 * Finds type of php annotation
 *
 * Very unfinished. Uses only first real ClassName.
 */
function parsePhpDocBlockType(typeString: string, nameResolverData: nikic.NameResolverData): php.Type {
    let pieces = typeString.split('|');

    let regexp = /^([\w\\]+)((\[\])*)$/;

    let ignoredTypes = ['boolean', 'bool', 'false', 'integer', 'int', 'float', 'double', 'string', 'null', 'callable', 'void', 'self', 'static', '$this', 'array'];

    for (let piece of pieces) {
        let match = regexp.exec(piece);
        if (match !== null) {
            let name = match[1];
            let brackets = match[2];
            let arrayDepth = brackets.length / 2;

            let className: string | undefined;

            if (name.includes('\\')) {
                if (name.startsWith('\\')) {
                    name = name.substr(1);
                }
                className = name;
            } else {
                if (!ignoredTypes.includes(name.toLowerCase()) && !name.toLowerCase().startsWith('array<')) {
                    className = nikic.resolveName([name], nameResolverData);
                }
            }

            if (className !== undefined) {
                let type: php.Type = new php.ObjectType(className);
                for (let i = 0; i < arrayDepth; i++) {
                    type = new php.ArrayType(type);
                }
                return type;
            }
        }
    }

    return new php.AnyType();
}

function docBlockToShortHelp(parsedDocBlock: ParsedDocBlock): string | null {
    let shortHelp: string | null = null;

    if (parsedDocBlock.rawTags.length > 0) {
        shortHelp = parsedDocBlock.rawTags.join('\n');
    }
    if (parsedDocBlock.summary !== undefined) {
        if (shortHelp === null) {
            shortHelp = parsedDocBlock.summary;
        } else {
            shortHelp = parsedDocBlock.summary + '\n\n' + shortHelp;
        }
    }

    return shortHelp;
}


function commentNodeToShortHelp(node: nikic.Comment_Doc | null): string | null {
    if (node !== null) {
        let parsedDocBlock = parsePhpDocBlock(node.text);
        if (parsedDocBlock !== null) {
            let shortHelp = docBlockToShortHelp(parsedDocBlock);
            return shortHelp;
        }
    }

    return null;
}

export function extractSomePhpClassInfo(code: string, stmts: nikic.Statement[]): php.PhpClassSomeInfo | null {
    if (stmts.length === 0) {
        return null;
    }

    let namespaceStmt = stmts.filter(row => row.nodeType === 'Stmt_Namespace')[0] as nikic.Stmt_Namespace;
    if (namespaceStmt === undefined) {
        return null;
    }

    let classStmt: nikic.Stmt_Class | nikic.Stmt_Interface;

    classStmt = namespaceStmt.stmts.filter(row => row.nodeType === 'Stmt_Class' || row.nodeType === 'Stmt_Interface')[0] as (typeof classStmt);
    if (classStmt === undefined) {
        return null;
    }

    let classCommentNode = nikic.lastDocComment(classStmt.attributes.comments);
    let classShortHelp = commentNodeToShortHelp(classCommentNode);

    let nameResolverData = nikic.findNameResolverData(stmts);

    let constants: php.PhpClassConstant[] = [];
    let methods: php.PhpClassMethod[] = [];
    let properties: php.PhpClassProperty[] = [];

    for (let stmt of classStmt.stmts) {
        let isPublic = (stmt.flags & (nikic.ClassModifier.MODIFIER_PROTECTED + nikic.ClassModifier.MODIFIER_PRIVATE)) === 0;

        if (stmt.nodeType === 'Stmt_ClassConst') {
            let offset = stmt.attributes.startFilePos;

            let constCommentNode = nikic.lastDocComment(stmt.attributes.comments);
            let constHelp = commentNodeToShortHelp(constCommentNode);

            for (let c of stmt.consts) {
                let constData: php.PhpClassConstant = {
                    isPublic,
                    name: c.name.name,
                    offset: (stmt.consts.length === 1) ? offset : c.attributes.startFilePos,
                };

                if (constHelp !== null) {
                    constData.shortHelp = constHelp;
                }

                let rawConstValue = nikic.nodeText(c.value, code);
                if (rawConstValue.length < 15 && !rawConstValue.includes('\n')) {
                    constData.valueText = rawConstValue;
                }

                constants.push(constData);
            }
        } else if (stmt.nodeType === 'Stmt_Property') {
            let offset = stmt.attributes.startFilePos;

            let propCommentNode = nikic.lastDocComment(stmt.attributes.comments);
            let propHelp = commentNodeToShortHelp(propCommentNode);

            for (let prop of stmt.props) {
                let propData: php.PhpClassProperty = {
                    isPublic,
                    name: prop.name.name,
                    offset: (stmt.props.length === 1) ? offset : prop.attributes.startFilePos,
                    type: new php.AnyType(),
                };

                if (propHelp !== null) {
                    propData.shortHelp = propHelp;
                }

                properties.push(propData);
            }

        } else if (stmt.nodeType === 'Stmt_ClassMethod') {
            let methodData: php.PhpClassMethod = {
                isPublic,
                name: stmt.name.name,
                offset: stmt.attributes.startFilePos,
                isStatic: (stmt.flags & nikic.ClassModifier.MODIFIER_STATIC) > 0,
                params: [],
                returnType: new php.AnyType(),
            };

            for (let p of stmt.params) {
                if (typeof p.var.name === 'string') {
                    methodData.params.push({
                        name: p.var.name,
                    });
                }
            }

            let methodCommentNode = nikic.lastDocComment(stmt.attributes.comments);
            let methodHelp = commentNodeToShortHelp(methodCommentNode);
            if (methodCommentNode !== null) {
                let parsedDocBlock = parsePhpDocBlock(methodCommentNode.text);

                if (parsedDocBlock !== null) {
                    let returnTag = parsedDocBlock.tags.filter(row => row.type === 'return')[0];
                    if (returnTag !== undefined) {
                        methodData.returnType = parsePhpDocBlockType(returnTag.typeString, nameResolverData);
                    }
                }
            }

            if (methodHelp !== null) {
                methodData.shortHelp = methodHelp;
            }

            methods.push(methodData);
        }
    }

    let result: php.PhpClassSomeInfo = {
        constants,
        properties,
        methods,
    };

    if (classShortHelp !== null) {
        result.shortHelp = classShortHelp;
    }
    return result;
}

/**
 * Searches for 'new TwigFunction()', 'new TwigTest()' and 'new TwigFilter()' calls everywhere and also for 'getGlobals()' call
 *
 * @param stmts         parsed 'code'
 */
export function findTwigExtensionElements(code: string, stmts: nikic.Statement[]) {
    let result: { elements: TwigExtensionCallable[]; globals: TwigExtensionGlobal[] } = { elements: [], globals: [] };

    let classStmts = nikic.findNodesOfType(stmts, 'Stmt_Class');

    if (classStmts.length === 0) {
        return result;
    }

    let classStmt = classStmts[0] as nikic.Stmt_Class;

    let someInfo = extractSomePhpClassInfo(code, stmts);
    let classMethods = (someInfo === null) ? [] : someInfo.methods;

    let exprNewNodes = nikic.findNodesOfType(classStmt, 'Expr_New') as nikic.Expr_New[];

    // TODO: fully resolve class names
    let classNames = ['TwigFunction', 'Twig_Function', 'TwigTest', 'Twig_Test', 'TwigFilter', 'Twig_Filter'];

    for (let exprNew of exprNewNodes) {
        if (!(exprNew.class.nodeType === 'Name_FullyQualified' || exprNew.class.nodeType === 'Name')) {
            continue;
        }
        let classNameParts = exprNew.class.parts;
        let className = classNameParts[classNameParts.length - 1];

        if (!classNames.includes(className)) {
            continue;
        }

        let args = exprNew.args;

        if (args.length === 0) {
            continue;
        }

        let firstArg = args[0];

        if (firstArg.value.nodeType !== 'Scalar_String') {
            continue;
        }
        let itemName = firstArg.value.value;
        let itemNameStartOffset = firstArg.value.attributes.startFilePos;
        let itemNameEndOffset = firstArg.value.attributes.endFilePos + 1;

        let element: TwigExtensionCallable | null = null;
        let offset = exprNew.attributes.startFilePos;

        if (className === 'TwigFunction' || className === 'Twig_Function') {
            element = { type: 'function', name: itemName, constructorOffset: offset, nameStartOffset: itemNameStartOffset, nameEndOffset: itemNameEndOffset };
        } else if (className === 'TwigTest' || className === 'Twig_Test') {
            element = { type: 'test', name: itemName, constructorOffset: offset, nameStartOffset: itemNameStartOffset, nameEndOffset: itemNameEndOffset };
        } else if (className === 'TwigFilter' || className === 'Twig_Filter') {
            element = { type: 'filter', name: itemName, constructorOffset: offset, nameStartOffset: itemNameStartOffset, nameEndOffset: itemNameEndOffset };
        } else {
            continue;
        }

        result.elements.push(element);

        if (args.length < 2) {
            continue;
        }

        let needsContext = false;
        let needsEnvironment = false;
        // search for environment-aware and contenxt-aware functions and filters
        do {
            if (args.length < 3) {
                break;
            }

            let thirdArgValue = args[2].value;

            if (thirdArgValue.nodeType !== 'Expr_Array') {
                break;
            }

            for (let item of thirdArgValue.items) {
                if (item.key !== null && item.key.nodeType === 'Scalar_String' && item.key.value === 'needs_context') {
                    if (nikic.nodeText(item.value, code).toLowerCase() === 'true') {
                        needsContext = true;
                    }
                }

                if (item.key !== null && item.key.nodeType === 'Scalar_String' && item.key.value === 'needs_environment') {
                    if (nikic.nodeText(item.value, code).toLowerCase() === 'true') {
                        needsEnvironment = true;
                    }
                }
            }
        } while (false);

        let secondArgValue = args[1].value;

        let implData: { params: { name: string }[]; offset: number; help?: string; returnType: php.Type } | undefined;

        if (secondArgValue.nodeType === 'Expr_Array') {
            do {
                let arrayItems = secondArgValue.items;

                if (arrayItems.length < 2) {
                    break;
                }

                if (arrayItems[0].key !== null || arrayItems[1].key !== null) {
                    break;
                }

                let firstElementIsThis = arrayItems[0].value.nodeType === 'Expr_Variable' && arrayItems[0].value.name === 'this';

                let secondElementStringLiteral: string | undefined;
                if (arrayItems[1].value.nodeType === 'Scalar_String') {
                    secondElementStringLiteral = arrayItems[1].value.value;
                }

                let foundMethod: php.PhpClassMethod | undefined;
                if (firstElementIsThis && secondElementStringLiteral !== undefined) {
                    foundMethod = classMethods.filter(row => row.name === secondElementStringLiteral)[0];
                }

                if (foundMethod !== undefined) {
                    implData = { params: foundMethod.params, offset: foundMethod.offset, help: foundMethod.shortHelp, returnType: foundMethod.returnType };
                }
            } while (false);
        } else if (secondArgValue.nodeType === 'Expr_Closure') {
            let params = [];
            for (let p of secondArgValue.params) {
                if (typeof p.var.name === 'string') {
                    params.push({
                        name: p.var.name,
                    });
                }
            }

            implData = { params, offset: secondArgValue.attributes.startFilePos, returnType: new php.AnyType() };
        }

        if (implData !== undefined) {
            let usedParams;
            if (element.type === 'test' || element.type === 'filter') {
                usedParams = implData.params.slice(1);
            } else {
                usedParams = implData.params;
            }

            if (element.type === 'filter' || element.type === 'function') {
                if (needsContext) {
                    usedParams = usedParams.slice(1);
                }

                if (needsEnvironment) {
                    usedParams = usedParams.slice(1);
                }
            }

            element.implementation = {
                params: usedParams,
                offset: implData.offset,
                returnType: implData.returnType,
            };

            if (implData.help !== undefined) {
                element.implementation.help = implData.help;
            }
        }
    }

    // search for globals
    do {
        let classMethodStmts = nikic.findNodesOfType(classStmt, 'Stmt_ClassMethod') as nikic.Stmt_ClassMethod[];

        let getGlobalsMethod = classMethodStmts.find(row => row.name.name === 'getGlobals');
        if (getGlobalsMethod === undefined) {
            break;
        }

        let returns = nikic.findNodesOfType(getGlobalsMethod, 'Stmt_Return') as nikic.Stmt_Return[];
        if (returns.length === 0) {
            break;
        }

        let lastReturn = returns[returns.length - 1]; // probably the best bet
        if (lastReturn.expr === null || lastReturn.expr.nodeType !== 'Expr_Array') {
            break;
        }

        for (let arrayItem of lastReturn.expr.items) {
            if (arrayItem.key === null) {
                continue;
            }
            let arrayItemKey = arrayItem.key;

            if (arrayItemKey.nodeType === 'Scalar_String') {
                result.globals.push({
                    type: 'global',
                    name: arrayItemKey.value,
                    nameStartOffset: arrayItemKey.attributes.startFilePos,
                    nameEndOffset: arrayItemKey.attributes.endFilePos,
                });
            }
        }
    } while (false);

    return result;
}

export let targetEntityRegexp = /(@(ORM\\)?(ManyToOne|ManyToMany|OneToOne|OneToMany)\s*\(.*targetEntity\s*=\s*["'])([\w\\]+)["']/;

let embedRegexp = /(@(ORM\\)?Embedded\s*\(.*class\s*=\s*["'])([\w\\]+)["']/;

function parseEntity(classNode: nikic.Stmt_Class, nameResolverData: nikic.NameResolverData): EntityData | null {
    if (classNode.attributes.comments === undefined) {
        return null;
    }

    let entityCommentNode = nikic.lastDocComment(classNode.attributes.comments);
    if (entityCommentNode === null) {
        return null;
    }

    let entityComment = entityCommentNode.text;
    if (!(entityComment.includes('@ORM\\Entity') || entityComment.includes('@Entity') || entityComment.includes('@ORM\\Embeddable') || entityComment.includes('@Embeddable'))) {
        return null;
    }

    let fields: EntityFieldData[] = [];

    for (let stmt of classNode.stmts) {
        if (stmt.nodeType !== 'Stmt_Property') {
            continue;
        }

        if (stmt.props.length !== 1) {
            continue;
        }

        let propCommentNode = nikic.lastDocComment(stmt.attributes.comments);
        if (propCommentNode === null) {
            continue;
        }

        let propComment = propCommentNode.text;
        if (!(propComment.includes('@ORM\\Column') || propComment.includes('@Column')
                || propComment.includes('@ORM\\ManyToOne') || propComment.includes('@ManyToOne')
                || propComment.includes('@ORM\\ManyToMany') || propComment.includes('@ManyToMany')
                || propComment.includes('@ORM\\OneToOne') || propComment.includes('@OneToOne')
                || propComment.includes('@ORM\\OneToMany') || propComment.includes('@OneToMany')
                || propComment.includes('@ORM\\Embedded') || propComment.includes('@Embedded')
            )) {
            continue;
        }

        let fieldType: string | undefined;
        let joinType: string | undefined;
        let isEmbedded = false;
        do {
            let match;

            match = /@(ORM\\)?Column\s*\(.*type\s*=\s*["'](\w+)["']/.exec(propComment);
            if (match !== null) {
                fieldType = match[2];
                break;
            }

            match = targetEntityRegexp.exec(propComment);
            if (match !== null) {
                let name = match[4];
                if (name.includes('\\')) {
                    if (name.startsWith('\\')) {
                        name = name.substr(1);
                    }
                    fieldType = name;
                } else {
                    fieldType = nikic.resolveName([name], nameResolverData);
                }
                joinType = match[3];
                break;
            }

            match = embedRegexp.exec(propComment);
            if (match !== null) {
                let name = match[3];

                if (name.includes('\\')) {
                    if (name.startsWith('\\')) {
                        name = name.substr(1);
                    }
                    fieldType = name;
                } else {
                    fieldType = nikic.resolveName([name], nameResolverData);
                }

                isEmbedded = true;
                break;
            }
        } while (false);

        if (fieldType === undefined) {
            continue;
        }

        let fieldData: EntityFieldData = {
            name: stmt.props[0].name.name,
            nameStartOffset: stmt.props[0].name.attributes.startFilePos,
            nameEndOffset: stmt.props[0].name.attributes.endFilePos + 1,
            offset: stmt.attributes.startFilePos,
            type: fieldType,
            isEmbedded,
        };

        if (joinType === 'ManyToOne' || joinType === 'ManyToMany' || joinType === 'OneToOne' || joinType === 'OneToMany') {
            fieldData.joinType = joinType;
        }

        fields.push(fieldData);
    }

    if (fields.length === 0) {
        return null;
    }

    let result = {
        className: '', // TODO
        offset: 0, // TODO
        fields,
    };

    return result;
}

/**
 * Common data for annotation-mapping and xml-mapping
 */
export interface EntityData {
    className: string;
    offset: number; // 'natural' offset of entity definition
    fields: EntityFieldData[];
}

interface EntityFieldData {
    name: string;
    offset: number; // start of private/public
    nameStartOffset: number;
    nameEndOffset: number;
    type: string;
    joinType?: EntityFieldJoinType;
    isEmbedded: boolean;
}

type EntityFieldJoinType = 'ManyToOne' | 'ManyToMany' | 'OneToOne' | 'OneToMany';

export function isLooksLikeDQL(str: string): boolean {
    let regexp = /^\s*(select|update|delete)\s+/i;

    return regexp.test(str);
}

/**
 * Returns object of form { p: 'App\Entity\Product', ... }
 */
export function collectEntitiesAliases(tokens: dql.Token[], entities: { [className: string]: EntityData }, entityNamespaces: { [alias: string]: string }): { [alias: string]: string } {
    let result: { [alias: string]: string } = Object.create(null);

    let tokenToEntityClass = (tokenIndex: number): string | null => {
        let token = tokens[tokenIndex];

        if (token.type === dql.TokenType.FULLY_QUALIFIED_NAME) {
            let entityClass = token.value;
            if (entities[entityClass] !== undefined) {
                return entityClass;
            }
        } else if (token.type === dql.TokenType.ALIASED_NAME) {
            let [usedAlias, usedEntity] = token.value.split(':');
            if (usedAlias !== undefined && usedEntity !== undefined && entityNamespaces[usedAlias] !== undefined) {
                let entityClass = entityNamespaces[usedAlias] + '\\' + usedEntity;
                if (entities[entityClass] !== undefined) {
                    return entityClass;
                }
            }
        }
        return null;
    };

    for (let i = 0; i < tokens.length; i++) {
        let token = tokens[i];

        if (token.type === dql.TokenType.FROM && i + 2 < tokens.length) {
            if ((tokens[i+1].type === dql.TokenType.FULLY_QUALIFIED_NAME || tokens[i+1].type === dql.TokenType.ALIASED_NAME)
                    && tokens[i+2].type === dql.TokenType.IDENTIFIER) {
                let entityClass = tokenToEntityClass(i+1);
                if (entityClass !== null) {
                    result[tokens[i+2].value] = entityClass;
                }
            }
        }

        if (token.type === dql.TokenType.JOIN) {
            if (i + 4 < tokens.length
                    && tokens[i+1].type === dql.TokenType.IDENTIFIER
                    && tokens[i+2].type === dql.TokenType.DOT
                    && tokens[i+3].type === dql.TokenType.IDENTIFIER
                    && dql.touchEachOther(tokens[i+1], tokens[i+2], tokens[i+3])
                    && tokens[i+4].type === dql.TokenType.IDENTIFIER) {
                let alias = tokens[i+4].value;
                let existingAlias = tokens[i+1].value;
                let existingAliasField = tokens[i+3].value;

                if (result[existingAlias] !== undefined && entities[result[existingAlias]] !== undefined) {
                    let entityData = entities[result[existingAlias]];
                    let field = entityData.fields.find(row => row.name === existingAliasField);

                    if (field !== undefined && field.joinType !== undefined) {
                        result[alias] = field.type;
                    }
                }
            } else if (i + 2 < tokens.length
                    && (tokens[i+1].type === dql.TokenType.FULLY_QUALIFIED_NAME || tokens[i+1].type === dql.TokenType.ALIASED_NAME)
                    && tokens[i+2].type === dql.TokenType.IDENTIFIER) {
                let entityClass = tokenToEntityClass(i+1);
                if (entityClass !== null) {
                    result[tokens[i+2].value] = entityClass;
                }
            }
        }
    }

    return result;
}

interface ServiceXmlDescription {
    id: string;
    fileUri: string;
    tagStartOffset: number;
    tagEndOffset: number; // offset of next symbol after the last symbol of '<service ...>' or '<service .../>'

    // Don't make 'class' mandatory. Example is <service id="kernel" synthetic="true" public="true" />.
    class?: string;
}

interface TemplateBlockInfo {
    templateName: string;
    name: string;
    offset: number;
    layout: 'short'|'one-line'|'lines';
}

interface TemplateMacroDescription {
    name: string;
    offset: number;
    comment?: string;
    definitionString: string;
    arguments: { name: string }[];
}

export interface TemplateDescription {
    name: string; // which is used in 'render()'
    fileUri: string;
    extends?: string; // value of {%extends%}. don't remove '!' from '@!AnyBundle/...'.
    tokens: TwigToken[];
    blocks: TemplateBlockInfo[];
    macros: TemplateMacroDescription[];
}

type TwigTestObjectResult = {
    type: 'function'; // it is also 'test' and 'filter'
    fileUri: string;
    element: TwigExtensionCallable;
    hoverLeftOffset: number;
    hoverRightOffset: number;
} | {
    type: 'renderParams';
    params: { callerFileUri: string; paramOffset: number; className: string; methodName: string }[];
    hoverLeftOffset: number;
    hoverRightOffset: number;
} | {
    type: 'global';
    fileUri: string;
    offset: number;
    name: string;
    value?: string;
    hoverLeftOffset: number;
    hoverRightOffset: number;
} | {
    type: 'macroFileImport';
    templateName: string;
    hoverLeftOffset: number;
    hoverRightOffset: number;
};

export function hoverForTwigExtension(element: TwigExtensionCallable, filePath: string): string {
    let helpPieces: string[] = ['```'];

    let prefix = 'function';
    if (element.type === 'test') {
        prefix = '... is';
    } else if (element.type === 'filter') {
        prefix = '... |';
    }

    if (element.implementation !== undefined) {
        let impl = element.implementation;
        let paramsNames = impl.params.map(row => row.name);

        let paramsPart = '';
        if (paramsNames.length > 0 || element.type === 'function') {
            paramsPart = '(' + paramsNames.join(', ') + ')';
        }

        helpPieces.push(prefix + ' ' + element.name + paramsPart);
        if (impl.help !== undefined) {
            helpPieces.push(impl.help);
        }
    } else {
        helpPieces.push(prefix + ' ' + element.name + '(?)');
        helpPieces.push('from ' + filePath);
    }

    helpPieces.push('```');

    return helpPieces.join('\n');
}

type DqlTestPositionResult = {
    type: 'entityClass';
    className: string;
    hoverLeftOffset: number;
    hoverRightOffset: number;
} | {
    type: 'entityField';
    className: string;
    accessPath: string[];
    hoverLeftOffset: number;
    hoverRightOffset: number;
};

const enum ProjectType {
    BASIC,
    SYMFONY,
}

interface XmlFile {
    entity?: EntityData;
}

function parseXmlForEntityData(code: string): null | EntityData {
    let indexA = code.indexOf('<doctrine-mapping');
    let indexB = code.indexOf('<entity');

    if (indexA < 0 || indexB < 0 || indexA > indexB) {
        return null;
    }

    let parser = sax.parser(true, { position: true });

    let base: undefined | { className: string; offset: number };

    let fields: EntityFieldData[] = [];

    parser.onopentag = (tag): void => {
        if (tag.name === 'entity') {
            let tagStart = code.lastIndexOf('<entity', parser.position);
            if (tagStart >= 0 && typeof tag.attributes.name === 'string') {
                base = { className: tag.attributes.name, offset: tagStart };
            }
        } else if (tag.name === 'field' || tag.name === 'id') {
            let tagStart = code.lastIndexOf('<' + tag.name, parser.position);
            if (tagStart >= 0 && typeof tag.attributes.name === 'string' && typeof tag.attributes.type === 'string') {
                // TODO: review remaining fields
                fields.push({
                    name: tag.attributes.name,
                    type: tag.attributes.type,
                    isEmbedded: false,
                    offset: tagStart,
                    nameStartOffset: tagStart + 1,
                    nameEndOffset: tagStart + 2,
                });
            }
        } else if (tag.name === 'many-to-one' || tag.name === 'many-to-many' || tag.name === 'one-to-one' || tag.name === 'one-to-many') {
            let tagStart = code.lastIndexOf('<' + tag.name, parser.position);
            if (tagStart >= 0 && typeof tag.attributes.field === 'string' && typeof tag.attributes['target-entity'] === 'string') {
                let joinType: undefined | EntityFieldJoinType;
                if (tag.name === 'many-to-one') {
                    joinType = 'ManyToOne';
                } else if (tag.name === 'many-to-many') {
                    joinType = 'ManyToMany';
                } else if (tag.name === 'one-to-many') {
                    joinType = 'OneToMany';
                } else if (tag.name === 'one-to-one') {
                    joinType = 'OneToOne';
                }

                if (joinType === undefined) {
                    return;
                }

                let type = tag.attributes['target-entity'];
                if (!type.includes('\\')) {
                    if (base === undefined) {
                        return;
                    } else if (base.className.includes('\\')) {
                        let lastSlashIndex = base.className.lastIndexOf('\\');
                        if (lastSlashIndex >= 0) {
                            type = base.className.substr(0, lastSlashIndex) + '\\' + type;
                        }
                    }
                }

                // TODO: review remaining fields
                fields.push({
                    name: tag.attributes.field,
                    offset: tagStart,
                    joinType,
                    nameStartOffset: tagStart + 1,
                    nameEndOffset: tagStart + 2,
                    isEmbedded: false,
                    type,
                });
            }
        }
    };

    parser.write(code).close();

    if (base !== undefined) {
        return {
            className: base.className,
            offset: base.offset,
            fields,
        };
    }

    return null;
}

interface BundleInfo {
    name: string;
    folderUri: string;
}

// TODO: probably should create subclass 'SymfonyProject' of class 'Project'
export class Project {
    private name: string;
    private folderUri: string;
    private allDocuments: AllTextDocuments;

    private phpClassNameToFileUri: { [className: string]: string } = Object.create(null);
    public phpClasses: { [fileUri: string]: PhpClass } = Object.create(null);

    public xmlFiles: { [fileUri: string]: XmlFile } = Object.create(null);

    private services: { [id: string]: ServiceXmlDescription } = Object.create(null);

    // it seems that 'TemplateDescription#name' is unique key
    public templates: { [fileUri: string]: TemplateDescription} = Object.create(null);

    private twigYaml?: {
        uri: string;
        globals: { name: string; offset: number; value: string }[];
    };
    public containerParametersPositions: { [fileUri: string]: { [name: string]: { offset: number } } } = Object.create(null);

    private readonly NAMESPACE_REGEXP = /^namespace\s+([\w\\]+)/m;

    // when changing, dont forget to check number of found classes
    private readonly CLASS_REGEXP = /^((\s*)((abstract|final)\s+)?(class|interface)\s+)(\w+)/m;

    private readonly TWIG_REGEXP = /TwigFunction|TwigFilter|TwigTest|Twig_Function|Twig_Filter|Twig_Test|getGlobals/;

    private throttledScanRoutes?: () => void;
    private throttledScanContainerParameters?: () => void;
    private throttledScanAutowired?: () => void;
    private throttledScanDoctrineEntityNamespaces?: () => void;

    private isScanning = false;

    private getSettings: () => Promise<SymfonyHelperSettings|null> = () => Promise.resolve(null);

    public templatesFolderUri: string;
    private sourceFolders: string[]; // Relative paths to folders with php and configuration. Elements must not start and end with '/'.
    private type: ProjectType = ProjectType.BASIC;

    private symfonyReader?: DirectSymfonyReader;

    constructor(name: string, folderUri: string, allDocuments: AllTextDocuments) {
        this.name = name;

        this.folderUri = folderUri;

        this.allDocuments = allDocuments;

        let composerJsonPath = URI.parse(folderUri + '/composer.json').fsPath;
        let lockfilePath = URI.parse(folderUri + '/symfony.lock').fsPath;

        let symfonyLayout: undefined | 'before-4' | '4';
        do {
            if (fs.existsSync(lockfilePath)) {
                symfonyLayout = '4';
                break;
            }

            try {
                let composerJsonContent = fs.readFileSync(composerJsonPath, { encoding: 'utf8' });
                let json = JSON.parse(composerJsonContent);
                let version = json.require['symfony/symfony'] as string;
                let prefixVariants = ['2.', '^2.', '~2.', '3.', '^3.', '~3.'];
                for (let v of prefixVariants) {
                    if (version.startsWith(v)) {
                        symfonyLayout = 'before-4';
                        break;
                    }
                }
            } catch {}
        } while (false);

        if (symfonyLayout !== undefined) {
            this.type = ProjectType.SYMFONY;

            if (symfonyLayout === 'before-4') {
                this.templatesFolderUri = this.folderUri + '/app/Resources/views';
            } else {
                this.templatesFolderUri = this.folderUri + '/templates';
            }
        } else {
            this.templatesFolderUri = this.folderUri + '/templates';
        }

        this.sourceFolders = ['src'];

        if (this.type == ProjectType.SYMFONY) {
            let symfonyReader = new DirectSymfonyReader(
                () => this.getSettings(), // 'this.getSettings' is not defined right now. How to fix it?
                this.getFolderPath(),
            );

            this.symfonyReader = symfonyReader;

            this.throttledScanRoutes = throttle(
                () => {
                    symfonyReader.scanRoutes()
                        .catch(() => {});
                },
                3000,
            );

            this.throttledScanAutowired = throttle(
                () => {
                    symfonyReader.scanAutowiredServices()
                        .catch(() => {});
                },
                3000,
            );

            this.throttledScanContainerParameters = throttle(
                () => {
                    symfonyReader.scanContainerParameters()
                        .catch(() => {});
                },
                3000,
            );

            this.throttledScanDoctrineEntityNamespaces = throttle(
                () => {
                    symfonyReader.scanDoctrineEntityNamespaces()
                        .catch(() => {});
                },
                1000,
            );
        }
    }

    public getFolderUri(): string {
        return this.folderUri;
    }

    public async scan(): Promise<void> {
        if (this.isScanning) {
            return;
        }

        this.isScanning = true;

        try {
            await this.doScan();
        } catch {
            console.log(`project.ts: failed scanning of project '${this.getName()}'`);
        }

        this.isScanning = false;
    }

    // how to remove code duplication with 'this.documentChanged()'?
    private async doScan(): Promise<void> {
        if (this.type === ProjectType.BASIC) {
            let settings = await this.getSettings();
            if (settings !== null) {
                this.templatesFolderUri = this.folderUri + '/' + settings.templatesFolder;
                this.sourceFolders = settings.sourceFolders;
            }
        }

        let folderFsPath = this.getFolderPath();

        // use 'readFile()' for 'vendor/' and 'TextDocument#getText()' for everything else
        let getCode = async (filePath: string): Promise<string | null> => {
            let fileUri = URI.file(filePath).toString();

            if (fileUri.startsWith(this.folderUri + '/vendor/')) {
                return await readFile(filePath);
            } else {
                let doc = await this.getDocument(fileUri);
                if (doc === null) {
                    return null;
                } else {
                    return doc.getText();
                }
            }
        };

        // should be executed before collecting render calls
        if (this.symfonyReader !== undefined) {
            await this.symfonyReader.scanDoctrineEntityNamespaces();
        }

        // searching services in xml-files in 'vendor/
        {
            let xmlFiles = await findFiles(folderFsPath + '/vendor/**/*.xml');

            let newServices: { [id: string]: ServiceXmlDescription } = Object.create(null);

            for (let filePath of xmlFiles) {
                // rewrite to test only part of path inside of 'folderUri'
                if (filePath.includes('/Tests/')) {
                    continue;
                }

                // rewrite to test only part of path inside of 'folderUri'
                if (!filePath.includes('/Resources/config/')) {
                    continue;
                }

                let fileUri = URI.file(filePath).toString();

                let code = await getCode(filePath) as string; // 'as string' for 'parser.onopentag()'
                if (code === null) {
                    continue;
                }

                let parser = sax.parser(true, { position: true });

                parser.onopentag = (tag): void => {
                    if (!(tag.name === 'service' && typeof tag.attributes.id === 'string')) {
                        return;
                    }

                    let tagStart = code.lastIndexOf('<service ', parser.position);
                    if (tagStart < 0) {
                        return;
                    }

                    let serviceId = tag.attributes.id;

                    let serviceDescription: ServiceXmlDescription = {
                        fileUri,
                        id: serviceId,
                        tagStartOffset: tagStart,
                        tagEndOffset: parser.position,
                    };

                    if (typeof tag.attributes.class === 'string') {
                        serviceDescription.class = tag.attributes.class;
                    }

                    newServices[serviceId] = serviceDescription;
                };

                parser.write(code).close();
            }

            this.services = newServices;
        }

        let projectXmlFiles: string[];
        {
            let tmp: string[][] = [];

            // symfony 4 projects
            tmp.push(await findFiles(folderFsPath + '/config/**/*.xml'));

            // projects before symfony 4
            // 1. probably useless
            // 2. I don't use whole '/app/' to skip '/app/cache/' from symfony 2
            tmp.push(await findFiles(folderFsPath + '/app/config/**/*.xml'));
            tmp.push(await findFiles(folderFsPath + '/app/Resourses/**/*.xml'));

            for (let folder of this.sourceFolders) {
                tmp.push(await findFiles(folderFsPath + '/' + folder + '/**/*.xml'));
            }

            projectXmlFiles = ([] as string[]).concat(...tmp);
        }

        for (let filePath of projectXmlFiles) {
            let code = await readFile(filePath);

            let entity = parseXmlForEntityData(code);
            if (entity !== null) {
                let fileUri = URI.file(filePath).toString();
                this.xmlFiles[fileUri] = { entity };
            }
        }

        let projectPhpFiles: string[];
        {
            let tmp: string[][] = [];
            for (let folder of this.sourceFolders) {
                tmp.push(await findFiles(folderFsPath + '/' + folder + '/**/*.php'));
            }
            projectPhpFiles = ([] as string[]).concat(...tmp);
        }

        // parsing php-files (list of all classes, twig extensions, bundles)
        {
            let vendorPhpFiles = await findFiles(folderFsPath + '/vendor/**/*.php');

            let phpFiles = vendorPhpFiles.concat(projectPhpFiles);

            let newPhpClasses: { [fileUri: string]: PhpClass } = Object.create(null);
            let newPhpClassNameToFileUri: { [fileUri: string]: string } = Object.create(null);

            for (let filePath of phpFiles) {
                let relativePath = filePath.substr(folderFsPath.length);

                if (relativePath.includes('/Tests/') || relativePath.includes('/tests/') || relativePath.startsWith('/vendor/composer/')) {
                    continue;
                }

                let fileUri = URI.file(filePath).toString();
                let code = await getCode(filePath);
                if (code === null) {
                    continue;
                }

                let res = await this.scanPhpFile(fileUri, code);
                if (res !== null) {
                    newPhpClassNameToFileUri[res.className] = fileUri;

                    if (res.phpClass !== null) {
                        newPhpClasses[fileUri] = res.phpClass;
                    }
                }
            }

            this.phpClasses = newPhpClasses;
            this.phpClassNameToFileUri = newPhpClassNameToFileUri;
        }

        // searching for templates
        {
            let templatesFolderPath = URI.parse(this.templatesFolderUri).fsPath;
            let templateFiles = await findFiles(templatesFolderPath + '/**/*.twig');

            for (let filePath of templateFiles) {
                let fileUri = URI.file(filePath).toString();

                let code = await getCode(filePath);
                if (code === null) {
                    continue;
                }

                let templateName = fileUri.substr(this.templatesFolderUri.length + 1);

                let descr = this.scanTwigTemplate(fileUri, templateName, code);

                this.templates[fileUri] = descr;
            }

            for (let fileUri in this.phpClasses) {
                let phpClass = this.phpClasses[fileUri];

                if (phpClass.bundle !== undefined) {
                    let bundleFolderPath = URI.parse(phpClass.bundle.folderUri).fsPath;
                    let bundleTemplateFiles = await findFiles(bundleFolderPath + '/Resources/views/**/*.twig');

                    for (let filePath of bundleTemplateFiles) {
                        let fileUri = URI.file(filePath).toString();

                        let code = await getCode(filePath);
                        if (code === null) {
                            continue;
                        }

                        let bundleName = phpClass.bundle.name.substr(0, phpClass.bundle.name.length - 'Bundle'.length);
                        let templateName = '@' + bundleName + '/' + fileUri.substr(phpClass.bundle.folderUri.length + '/Resources/views/'.length);

                        let descr = this.scanTwigTemplate(fileUri, templateName, code);

                        this.templates[fileUri] = descr;
                    }
                }
            }
        }

        // parsing 'config/packages/twig.yaml'
        {
            let yamlFileUri = this.folderUri + '/config/packages/twig.yaml';

            let yamlDoc = await this.getDocument(yamlFileUri);

            if (yamlDoc !== null) {
                let text = yamlDoc.getText();

                this.twigYaml = {
                    uri: yamlFileUri,
                    globals: findTwigGlobalsInYaml(text),
                };
            }
        }

        if (this.symfonyReader !== undefined) {
            // don't combine into one try-block! try each method.
            try {
                await this.symfonyReader.scanRoutes();
            } catch {}

            try {
                await this.symfonyReader.scanAutowiredServices();
            } catch {}

            try {
                await this.symfonyReader.scanContainerParameters();
            } catch {}
        }

        // searching for parameters in 'config/services.yaml'
        do {
            let fileUri = this.folderUri + '/config/services.yaml';
            let filePath = URI.parse(fileUri).fsPath;
            if (!await fileExists(filePath)) {
                break;
            }

            let code = await getCode(filePath);
            if (code === null) {
                break;
            }

            this.scanServicesYaml(fileUri, code);
        } while (false);
    }

    private async scanPhpFile(fileUri: string, code: string, forceFullParse = false) {
        let classMatch = this.CLASS_REGEXP.exec(code);

        if (classMatch === null || classMatch.index === undefined) {
            return null;
        }

        let className = classMatch[6];
        let fullClassName;
        let namespaceMatch = this.NAMESPACE_REGEXP.exec(code);
        if (namespaceMatch !== null) {
            fullClassName = namespaceMatch[1] + '\\' + className;
        } else {
            fullClassName = className;
        }

        let result = {
            className: fullClassName,
            phpClass: null as PhpClass|null,
        };

        let fileIsTwigExtension = this.TWIG_REGEXP.test(code);
        let fileIsFromSourceFolders = this.isFromSourceFolders(fileUri)
        let fileIsBundleBase = fileUri.endsWith('Bundle.php') && !fileUri.endsWith('/Bundle.php');

        let fullParse = fileIsTwigExtension || fileIsFromSourceFolders || fileIsBundleBase || forceFullParse;

        if (!fullParse) {
            return result;
        }

        let stmts = await nikic.parse(code);

        if (stmts === null) {
            return result;
        }

        let hasConstants = false;
        if (fileIsFromSourceFolders) {
            let constStmts = nikic.findNodesOfType(stmts, 'Stmt_ClassConst');
            if (constStmts.length > 0) {
                hasConstants = true;
            }
        }

        let someInfo = extractSomePhpClassInfo(code, stmts);

        let phpClass: PhpClass = {
            fullClassName,
            fileUri,
            hasConstants,
            stmts,
            offset: classMatch.index + classMatch[2].length,
            nameStartOffset: classMatch.index + classMatch[1].length,
            nameEndOffset: classMatch.index + classMatch[1].length + classMatch[6].length,
            type: (classMatch[5] === 'class') ? 'class' : 'interface',
            shortHelp: (someInfo === null) ? undefined : someInfo.shortHelp,
            constants: (someInfo === null) ? [] : someInfo.constants,
            methods: (someInfo === null) ? [] : someInfo.methods,
            properties: (someInfo === null) ? [] : someInfo.properties,
        };

        if (fileIsTwigExtension) {
            let { elements, globals } = findTwigExtensionElements(code, stmts);
            if (elements.length > 0) {
                phpClass.twigExtensionElements = elements;
            }
            if (globals.length > 0) {
                phpClass.twigExtensionGlobals= globals;
            }
        }

        if (fileIsBundleBase) {
            // it seems 'path.basename()' and 'path.dirname()' work on uris
            let bundleName = path.basename(fileUri, '.php');
            let folderUri = path.dirname(fileUri);

            phpClass.bundle = { name: bundleName, folderUri };
        }

        if (fileIsFromSourceFolders) {
            do {
                let nameResolverData = nikic.findNameResolverData(stmts);
                if (nameResolverData.namespace === null) {
                    continue;
                }

                let classNode = (nikic.findNodesOfType(stmts, 'Stmt_Class') as nikic.Stmt_Class[])[0];
                if (classNode === undefined) {
                    continue;
                }

                // searching for entities
                {
                    let entityData = parseEntity(classNode, nameResolverData);

                    if (entityData !== null) {
                        phpClass.entity = entityData;
                    }
                }

                // searching for entity repositories
                {
                    let entityFullClassName = this.testEntityRepository(classNode, nameResolverData);

                    if (entityFullClassName !== null) {
                        phpClass.entityRepository = { entityFullClassName };
                    }
                }

                // parsing dql queries
                {
                    let parsedDqlQueries = [];

                    let strings = nikic.findNodesOfType(stmts, 'Scalar_String') as nikic.Scalar_String[];
                    for (let str of strings) {
                        let fullScalar = code.substring(str.attributes.startFilePos, str.attributes.endFilePos + 1);
                        let scalarStringValueIndex = fullScalar.indexOf(str.value);
                        if (scalarStringValueIndex < 0) {
                            continue;
                        }
                        let stringLiteralOffset = str.attributes.startFilePos + scalarStringValueIndex;

                        if (isLooksLikeDQL(str.value)) {
                            let dqlTokens = dql.tokenize(str.value);
                            parsedDqlQueries.push({
                                literalOffset: stringLiteralOffset,
                                tokens: dqlTokens,
                            });
                        }
                    }

                    if (parsedDqlQueries.length > 0) {
                        phpClass.parsedDqlQueries = parsedDqlQueries;
                    }
                }

                // searching for render calls
                let renderCalls = this.findTemplateRenderCalls(stmts, fileUri, fullClassName);
                if (renderCalls.length > 0) {
                    phpClass.templateRenderCalls = renderCalls;
                }

            } while (false);
        }

        result.phpClass = phpClass;

        return result;
    }

    private scanTwigTemplate(fileUri: string, templateName: string, code: string): TemplateDescription {
        let tokens = tokenizeTwig(code);
        let twigPieces = findTwigPieces(tokens);

        let descr: TemplateDescription = {
            fileUri,
            tokens,
            name: templateName,
            blocks: [],
            macros: [],
        };

        let extendsMatch = /{%\s*extends\s+['"]([\w!@\./\-]+)['"]/.exec(code);
        if (extendsMatch !== null) {
            descr.extends = extendsMatch[1];
        }

        for (let i = 0; i < twigPieces.length; i++) {
            let piece = twigPieces[i];

            if (piece.type === 'block') {
                let str = code.substring(piece.start, piece.end);
                let blockMatch = /^{%\s*block\s+(\w+)/.exec(str);
                if (blockMatch !== null) {
                    let blockLayout: 'short'|'one-line'|'lines' = 'short';

                    if (/^{%\s*block\s+(\w+)\s*%}/.test(str)) {
                        let nextNewlineIndex = code.indexOf('\n', piece.end);

                        if (nextNewlineIndex > 0) {
                            let lineSuffix = code.substring(piece.end, nextNewlineIndex);
                            if (/{%\s*endblock\s*%}/.test(lineSuffix)) {
                                blockLayout = 'one-line';
                            } else {
                                blockLayout = 'lines';
                            }
                        } else {
                            blockLayout = 'lines';
                        }
                    }

                    descr.blocks.push({ templateName, name: blockMatch[1], offset: piece.start, layout: blockLayout });
                }

                // search for macro definition
                do {
                    if (twigTokenValue(code, tokens[piece.startToken + 1]) !== 'macro') {
                        break;
                    }

                    if (piece.endToken < piece.startToken + 5) {
                        break;
                    }

                    let nameToken = tokens[piece.startToken + 2];
                    if (nameToken.type !== TwigTokenType.NAME) {
                        break;
                    }

                    let firstBracketToken = tokens[piece.startToken + 3];
                    if (twigTokenValue(code, firstBracketToken) !== '(') {
                        break;
                    }

                    let lastBracketToken = tokens[piece.endToken - 1];
                    if (twigTokenValue(code, lastBracketToken) !== ')') {
                        break;
                    }

                    let macroArgs = macroArguments(piece, tokens, code);

                    let macroInfo: TemplateMacroDescription = {
                        name: twigTokenValue(code, nameToken),
                        offset: nameToken.offset,
                        definitionString: code.substring(tokens[piece.startToken + 1].offset, lastBracketToken.offset + 1),
                        arguments: macroArgs,
                    };

                    if (i > 0 && twigPieces[i-1].type === 'comment') {
                        let commentPiece = twigPieces[i-1];
                        let commentBody = code.substring(commentPiece.start + 2, commentPiece.end - 2);
                        if (commentBody.startsWith('#')) {
                            macroInfo.comment = commentBody.substr(1).trim();
                        }
                    }

                    descr.macros.push(macroInfo);
                } while (false);
            }
        }

        return descr;
    }

    private scanServicesYaml(fileUri: string, code: string): void {
        let node = yaml.safeLoad(code);

        if (node.kind !== yaml.Kind.MAP) {
            return;
        }

        let parametersMap;

        for (let topNode of node.mappings) {
            if (!(topNode.key && topNode.key.kind === yaml.Kind.SCALAR)) {
                continue;
            }

            if (!(topNode.value && topNode.value.kind === yaml.Kind.MAP)) {
                continue;
            }

            if (topNode.key.value === 'parameters') {
                parametersMap = topNode.value;
                break;
            }
        }

        if (parametersMap === undefined) {
            return;
        }

        let paramsPositions: { [name: string]: { offset: number }} = Object.create(null);

        for (let subNode of parametersMap.mappings) {
            if (subNode.key && subNode.key.kind === yaml.Kind.SCALAR) {
                paramsPositions[subNode.key.value] = { offset: subNode.key.startPosition };
            }
        }

        this.containerParametersPositions[fileUri] = paramsPositions;
    }

    public getFolderPath(): string {
        return URI.parse(this.folderUri).fsPath;
    }

    private async getDocument(uri: string): Promise<TextDocument | null> {
        return this.allDocuments.get(uri);
    }

    /**
     * Searches for '->render()' and '->renderView()' calls everywhere
     */
    public findTemplateRenderCalls(stmts: nikic.Statement[], callerUri: string, callerClassName: string): TemplateRenderCall[] {
        // TODO: get rid of weird parameters (callerUri, callerClassName) and clean TemplateRenderCall
        let classMethodNodes = nikic.findNodesOfType(stmts, 'Stmt_ClassMethod') as nikic.Stmt_ClassMethod[];

        let result: TemplateRenderCall[] = [];

        for (let methodNode of classMethodNodes) {
            let methodCallNodes = nikic.findNodesOfType(methodNode, 'Expr_MethodCall') as nikic.Expr_MethodCall[];

            if (methodCallNodes.length === 0) {
                continue;
            }

            for (let node of methodCallNodes) {
                if (node.name.nodeType !== 'Identifier') {
                    continue;
                }

                let methodName = node.name.name;
                if (methodName !== 'render' && methodName !== 'renderView') {
                    continue;
                }

                let args = node.args;

                if (args.length < 1) {
                    continue;
                }

                let firstArg = args[0];
                if (firstArg.value.nodeType !== 'Scalar_String') {
                    continue;
                }

                let templateName = firstArg.value.value;

                let renderCall: TemplateRenderCall = {
                    callerUri,
                    className: callerClassName,
                    methodName: methodNode.name.name,
                    name: templateName,
                    params: [],
                };
                result.push(renderCall);

                if (args.length < 2) {
                    continue;
                }

                let secondArgValue = args[1].value;
                if (secondArgValue.nodeType !== 'Expr_Array') {
                    continue;
                }

                for (let c of secondArgValue.items) {
                    if (c.key === null || c.key.nodeType !== 'Scalar_String') {
                        continue;
                    }

                    renderCall.params.push({
                        name: c.key.value,
                        offset: c.key.attributes.startFilePos,
                        valueNode: c.value,
                        methodNode,
                    });
                }
            }
        }

        return result;
    }

    /**
     * Finds primitive symbol table of method
     */
    public async symbolTable(methodNode: nikic.Stmt_ClassMethod, nameResolverData: nikic.NameResolverData): Promise<PlainSymbolTable> {
        let symbols: PlainSymbolTable = methodParamsSymbolTable(methodNode, nameResolverData);

        for (let stmt of methodNode.stmts) {
            if (stmt.nodeType === 'Stmt_Expression' && stmt.expr.nodeType === 'Expr_Assign') {
                let assignExpr = stmt.expr;

                if (assignExpr.var.nodeType !== 'Expr_Variable') {
                    continue;
                }

                if (typeof assignExpr.var.name !== 'string') {
                    continue;
                }

                let varName = assignExpr.var.name;

                let varTypeFromDocBlock: php.Type | undefined;
                let lastDocComment = nikic.lastDocComment(assignExpr.attributes.comments);
                if (lastDocComment !== null) {
                    let parsedDocComment = parsePhpDocBlock(lastDocComment.text);
                    if (parsedDocComment !== null) {
                        let varTag = parsedDocComment.tags.find(row => row.type === 'var');
                        if (varTag !== undefined) {
                            varTypeFromDocBlock = parsePhpDocBlockType(varTag.typeString, nameResolverData);
                        }
                    }
                }

                let varType: php.Type;
                if (varTypeFromDocBlock !== undefined && !(varTypeFromDocBlock instanceof php.AnyType)) {
                    varType = varTypeFromDocBlock;
                } else {
                    varType = await this.expressionType(assignExpr.expr, symbols, nameResolverData);
                }

                symbols[varName] = varType;
            }
        }

        return symbols;
    }

    private async expressionType(expression: nikic.Expression, symbols: PlainSymbolTable, nameResolverData: nikic.NameResolverData): Promise<php.Type> {
        if (expression.nodeType === 'Expr_New') {
            if (expression.class.nodeType === 'Name') {
                return new php.ObjectType(nikic.resolveName(expression.class.parts, nameResolverData));
            } else if (expression.class.nodeType === 'Name_FullyQualified') {
                return new php.ObjectType(expression.class.parts.join('\\'));
            }
        } else if (expression.nodeType === 'Expr_Variable') {
            if (typeof expression.name === 'string') {
                let varName = expression.name;
                if (symbols[varName] !== undefined) {
                    return symbols[varName];
                }
            }
        } else if (expression.nodeType === 'Expr_Array') {
            return new php.ArrayType(new php.AnyType());
        } else if (expression.nodeType === 'Expr_ArrayDimFetch') {
            let array = expression.var;
            let expressionType = await this.expressionType(array, symbols, nameResolverData);
            if (expressionType instanceof php.ArrayType) {
                return expressionType.getValueType();
            }
        } else if (expression.nodeType === 'Expr_MethodCall') {
            let varType = await this.expressionType(expression.var, symbols, nameResolverData);

            let entityRepositoryMethodDispatch = (methodName: string, entityClass: string): php.Type | undefined => {
                if (methodName === 'find' || methodName === 'findOneBy') {
                    return new php.ObjectType(entityClass);
                } else if (methodName === 'findAll' || methodName === 'findBy') {
                    return new php.ArrayType(new php.ObjectType(entityClass));
                } else {
                    return undefined;
                }
            };

            if (varType instanceof php.ObjectType) {
                let varClass = varType.getClassName();

                let phpClass = await this.getPhpClass(varClass);

                // methods on entity repository
                if (phpClass !== null && phpClass.entityRepository !== undefined) {
                    let entityClass = phpClass.entityRepository.entityFullClassName;

                    if (expression.name.nodeType === 'Identifier') {
                        let methodName = expression.name.name;

                        let result = entityRepositoryMethodDispatch(methodName, entityClass);

                        if (result !== undefined) {
                            return result;
                        }
                    }
                }

                // EntityManagerInterface#getRepository()
                do {
                    if (varClass !== 'Doctrine\\ORM\\EntityManagerInterface') {
                        break;
                    }

                    if (expression.name.nodeType !== 'Identifier' || expression.name.name !== 'getRepository') {
                        break;
                    }

                    if (expression.args.length === 0) {
                        break;
                    }

                    let firstArg = expression.args[0];

                    let entityClassName: string | null = null;

                    if (firstArg.value.nodeType === 'Scalar_String') {
                        entityClassName = firstArg.value.value;
                    } else if (firstArg.value.nodeType === 'Expr_ClassConstFetch') {
                        entityClassName = nikic.extractClassConstant(firstArg.value, nameResolverData);
                    }

                    if (entityClassName === null) {
                        break;
                    }

                    let entityClass = await this.getPhpClass(entityClassName);

                    if (entityClass === null || entityClass.entity === undefined) {
                        break;
                    }

                    for (let fileUri in this.phpClasses) {
                        let repositoryClass = this.phpClasses[fileUri];
                        if (repositoryClass.entityRepository !== undefined && repositoryClass.entityRepository.entityFullClassName === entityClassName) {
                            return new php.ObjectType(repositoryClass.fullClassName);
                        }
                    }

                    return new php.EntityRepositoryType(entityClassName);
                } while (false);

                // Doctrine\DBAL\Driver\Connection#fetchAll()
                do {
                    if (varClass !== 'Doctrine\\DBAL\\Driver\\Connection') {
                        break;
                    }

                    if (expression.name.nodeType !== 'Identifier') {
                        break;
                    }

                    let methodName = expression.name.name;

                    if (methodName !== 'fetchAll' && methodName !== 'fetchAssoc') {
                        break;
                    }

                    if (expression.args.length === 0) {
                        break;
                    }

                    let firstArg = expression.args[0];

                    if (firstArg.value.nodeType !== 'Scalar_String') {
                        break;
                    }
                    let sql = firstArg.value.value;

                    let fields = sqlSelectFields(sql);

                    let tupleFields: { [name: string]: php.Type } = Object.create(null);
                    for (let fieldName of fields) {
                        tupleFields[fieldName] = new php.AnyType();
                    }

                    let rowType = new php.ArrayType(new php.AnyType(), tupleFields);

                    if (methodName === 'fetchAll') {
                        return new php.ArrayType(rowType);
                    } else if (methodName === 'fetchAssoc') {
                        return rowType;
                    }

                } while (false);
            }

            if (varType instanceof php.EntityRepositoryType) {
                let entityClassName = varType.getEntityClassName();

                if (expression.name.nodeType === 'Identifier') {
                    let methodName = expression.name.name;

                    let result = entityRepositoryMethodDispatch(methodName, entityClassName);

                    if (result !== undefined) {
                        return result;
                    }
                }
            }

            if (varType instanceof php.DoctrineQueryType) {
                let entityClassName = varType.getEntityClassName();

                if (expression.name.nodeType === 'Identifier') {
                    let methodName = expression.name.name;

                    if (methodName === 'getResult') {
                        return new php.ArrayType(new php.ObjectType(entityClassName));
                    } else if (methodName === 'getSingleResult' || methodName === 'getOneOrNullResult') {
                        return new php.ObjectType(entityClassName);
                    } else if (methodName === 'setParameter' || methodName === 'setParameters' || methodName === 'setDQL') {
                        return varType;
                    }
                }
            }

            // createQuery()
            do {
                if (!(expression.name.nodeType === 'Identifier' && expression.name.name === 'createQuery')) {
                    break;
                }

                if (expression.args.length === 0) {
                    break;
                }

                let firstArg = expression.args[0];

                if (firstArg.value.nodeType !== 'Scalar_String') {
                    break;
                }

                let tokens = dql.tokenize(firstArg.value.value);
                let selectedName;
                if (tokens.length >= 2
                        && tokens[0].value.toLowerCase() === 'select'
                        && tokens[1].type === dql.TokenType.IDENTIFIER) {
                    selectedName = tokens[1].value;
                } else {
                    break;
                }

                let entities = this.getEntities();

                let identifierToEntity = collectEntitiesAliases(tokens, entities, this.getDoctrineEntityNamespaces());

                let selectedEntityClassName = identifierToEntity[selectedName];
                if (selectedEntityClassName === undefined) {
                    break;
                }

                return new php.DoctrineQueryType(selectedEntityClassName);

            } while (false);

        } else if (expression.nodeType === 'Expr_FuncCall') {
            let funcName: string | undefined;
            if (expression.name.nodeType === 'Name') {
                funcName = nikic.resolveName(expression.name.parts, nameResolverData);

                // usually we have no namespaced functions
                if (funcName.includes('\\') && expression.name.parts.length === 1) {
                    funcName = expression.name.parts[0];
                }
            } else if (expression.name.nodeType === 'Name_FullyQualified') {
                funcName = expression.name.parts.join('\\');
            }

            if (funcName !== undefined) {
                if (funcName === 'array_filter' || funcName === 'array_reverse' || funcName === 'array_slice' || funcName === 'array_values') {
                    do {
                        if (expression.args.length === 0) {
                            break;
                        }

                        let firstArg = expression.args[0];
                        let firstArgType = await this.expressionType(firstArg.value, symbols, nameResolverData);

                        if (firstArgType instanceof php.ArrayType) {
                            return firstArgType;
                        }
                    } while (false);
                } else if (funcName === 'array_chunk') {
                    if (expression.args.length > 0) {
                        let firstArg = expression.args[0];
                        let firstArgType = await this.expressionType(firstArg.value, symbols, nameResolverData);
                        return new php.ArrayType(firstArgType);
                    }
                } else if (funcName === 'array_pop' || funcName === 'array_shift') {
                    if (expression.args.length > 0) {
                        let firstArg = expression.args[0];
                        let firstArgType = await this.expressionType(firstArg.value, symbols, nameResolverData);
                        if (firstArgType instanceof php.ArrayType) {
                            return firstArgType.getValueType();
                        }
                    }
                }
            }
        }

        return new php.AnyType();
    }

    private findRenderCallsForTemplate(templateUri: string): TemplateRenderCall[] {
        let result: TemplateRenderCall[] = [];

        for (let fileUri in this.phpClasses) {
            let calls = this.phpClasses[fileUri].templateRenderCalls;
            if (calls === undefined) {
                continue;
            }

            for (let call of calls) {
                if (templateUri === this.templatesFolderUri + '/' + call.name) {
                    result.push(call);
                }
            }
        }

        return result;
    }

    public getEntities(): { [fullClassName: string]: EntityData } {
        let result: { [fullClassName: string]: EntityData } = Object.create(null);

        for (let fileUri in this.phpClasses) {
            let phpClass = this.phpClasses[fileUri];
            if (phpClass.entity !== undefined) {
                result[phpClass.fullClassName] = phpClass.entity;
            }
        }

        for (let fileUri in this.xmlFiles) {
            let entity = this.xmlFiles[fileUri].entity;
            if (entity !== undefined) {
                result[entity.className] = entity;
            }
        }

        return result;
    }

    public async collectRenderCallsParams(templateName: string): Promise<{[name: string]: php.Type}> {
        let result0: { [name: string]: php.Type[] } = {};

        for (let fileUri in this.phpClasses) {
            const phpClass = this.phpClasses[fileUri];

            let stmts = phpClass.stmts;
            let renderCalls = phpClass.templateRenderCalls;

            if (renderCalls === undefined) {
                continue;
            }

            let nameResolverData = nikic.findNameResolverData(stmts);

            for (let renderCall of renderCalls) {
                if (renderCall.name !== templateName) {
                    continue;
                }

                for (let param of renderCall.params) {
                    if (result0[param.name] === undefined) {
                        result0[param.name] = [];
                    }

                    let methodSymbolTable = await this.symbolTable(param.methodNode, nameResolverData);

                    let paramType = await this.expressionType(param.valueNode, methodSymbolTable, nameResolverData);

                    result0[param.name].push(paramType);
                }
            }
        }

        let result: { [name: string]: php.Type } = {};
        for (let name in result0) {
            result[name] = php.combineTypes(result0[name]);
        }

        return result;
    }

    public async onReferences(params: ReferenceParams): Promise<Location[]> {
        let documentUri = params.textDocument.uri;
        let position = params.position;

        if (!documentUri.startsWith(this.folderUri + '/')) {
            return [];
        }

        let document = await this.getDocument(documentUri);
        if (document === null) {
            return [];
        }

        // request from twig-file
        do {
            if (!(documentUri.startsWith(this.templatesFolderUri + '/') && documentUri.endsWith('.twig'))) {
                break;
            }

            let templateName = documentUri.substr((this.templatesFolderUri + '/').length);

            let code = document.getText();
            let offset = document.offsetAt(position);
            let parsed = twigFullParse(code);
            let { tokens } = parsed;

            // references of twig function, test or filter
            {
                let testResult = this.twigTestObject(documentUri, parsed, offset);
                if (testResult !== null) {
                    if (testResult.type === 'function') {
                        let extensionElement = testResult.element;
                        let extensionDocument = await this.getDocument(testResult.fileUri);
                        if (extensionDocument !== null) {
                            return this.referencesTwigExtensionElement(params, extensionElement, extensionDocument);
                        }
                    }
                }
            }

            do {
                let tokenUnderCursorIndex = tokenUnderCursor(tokens, TwigTokenType.NAME, offset);
                if (tokenUnderCursorIndex === null) {
                    break;
                }

                let initialScope = new Scope();

                let callParams = await this.collectRenderCallsParams(templateName);
                for (let name in callParams) {
                    initialScope.setValue(name, callParams[name]);
                }

                let { names } = await findExpressionData(
                    parsed,
                    initialScope,
                    (className: string) => this.getPhpClass(className),
                    (name: string) => this.twigFunctionReturnType(name)
                );

                if (names[tokenUnderCursorIndex] === undefined) {
                    break;
                }

                let nameInfo = names[tokenUnderCursorIndex];

                let fieldName = twigTokenValue(code, tokens[tokenUnderCursorIndex]);

                if (nameInfo.type === 'classMethod') {
                    return this.referencesEntityField(nameInfo.className, fieldName);
                }
            } while (false);
        } while (false);

        // request from php-file
        do {
            if (!documentUri.endsWith('.php')) {
                break;
            }

            let offset = document.offsetAt(position);

            let phpClass = this.phpClasses[documentUri];
            if (phpClass === undefined) {
                break;
            }

            // references of twig function, test or filter
            do {
                if (phpClass.twigExtensionElements === undefined) {
                    break;
                }

                let foundElement: TwigExtensionCallable | undefined;

                for (let element of phpClass.twigExtensionElements) {
                    if (element.nameStartOffset + 1 <= offset && offset <= element.nameEndOffset - 1) {
                        foundElement = element;
                    }
                }

                if (foundElement === undefined) {
                    break;
                }

                return this.referencesTwigExtensionElement(params, foundElement, document);
            } while (false);

            // request on classname or fieldname in php class of entity
            if (phpClass.entity !== undefined) {
                if (phpClass.nameStartOffset <= offset && offset <= phpClass.nameEndOffset) {
                    return this.referencesEntity(phpClass.fullClassName);
                }

                for (let field of phpClass.entity.fields) {
                    if (field.nameStartOffset <= offset && offset <= field.nameEndOffset) {
                        return this.referencesEntityField(phpClass.fullClassName, field.name);
                    }
                }
            }

            let code = document.getText();
            let stmts = await nikic.parse(code);
            if (stmts === null) {
                break;
            }

            // request on classname and aliased name in dql string
            do {
                let scalarString = nikic.findStringContainingOffset(stmts, offset);
                if (scalarString === null) {
                    break;
                }

                if (!isLooksLikeDQL(scalarString.value)) {
                    break;
                }

                let dqlTestPosition = await this.dqlTestPosition(scalarString, document, offset);
                if (dqlTestPosition === null) {
                    break;
                }

                if (dqlTestPosition.type === 'entityClass') {
                    return this.referencesEntity(dqlTestPosition.className);
                } else if (dqlTestPosition.type === 'entityField') {
                    let accessResult = await this.accessEntityWithPath(dqlTestPosition.className, dqlTestPosition.accessPath);
                    if (accessResult !== null) {
                        return this.referencesEntityField(accessResult.phpClass.fullClassName, accessResult.phpClassField.name);
                    }
                }
            } while (false);
        } while (false);

        return [];
    }

    private async referencesTwigExtensionElement(params: ReferenceParams, element: TwigExtensionCallable, elementDocument: TextDocument): Promise<Location[]> {
        let result: Location[] = [];

        if (params.context.includeDeclaration) {
            result.push({
                uri: elementDocument.uri,
                range: Range.create(
                    elementDocument.positionAt(element.nameStartOffset),
                    elementDocument.positionAt(element.nameEndOffset)
                )
            });
        }

        let findInTemplateType: 'functionCall' | 'filterCall' | 'testCall';
        if (element.type === 'function') {
            findInTemplateType = 'functionCall';
        } else if (element.type === 'filter') {
            findInTemplateType = 'filterCall';
        } else if (element.type === 'test') {
            findInTemplateType = 'testCall';
        } else {
            return result;
        }

        for (let fileUri in this.templates) {
            let descr = this.templates[fileUri];

            // speed optimization
            if (descr.name.startsWith('@')) {
                continue;
            }

            let templateDocument = await this.getDocument(fileUri);
            if (templateDocument === null) {
                continue;
            }

            let templateTokens = descr.tokens;

            let templateResults = this.findInTemplate(templateDocument.getText(), templateTokens, element.name, findInTemplateType);

            for (let n of templateResults) {
                let t = templateTokens[n];

                result.push({
                    uri: fileUri,
                    range: Range.create(
                        templateDocument.positionAt(t.offset),
                        templateDocument.positionAt(t.offset + t.length)
                    )
                });
            }
        }

        return result;
    }

    private async referencesEntity(fullClassName: string): Promise<Location[]> {
        let result: Location[] = [];

        let entityClass = await this.getPhpClass(fullClassName);
        if (entityClass === null) {
            return result;
        }

        let entityDocument = await this.getDocument(entityClass.fileUri);
        if (entityDocument === null) {
            return result;
        }

        result.push({
            uri: entityClass.fileUri,
            range: Range.create(
                entityDocument.positionAt(entityClass.nameStartOffset),
                entityDocument.positionAt(entityClass.nameEndOffset)
            )
        });

        for (let fileUri in this.phpClasses) {
            if (!this.isFromSourceFolders(fileUri)) {
                continue;
            }

            let phpClass = this.phpClasses[fileUri];
            if (phpClass.parsedDqlQueries === undefined) {
                continue;
            }

            for (let { literalOffset, tokens } of phpClass.parsedDqlQueries) {
                for (let token of tokens) {
                    if (token.type === dql.TokenType.FULLY_QUALIFIED_NAME && token.value === fullClassName) {
                        let phpClassDocument = await this.getDocument(phpClass.fileUri);
                        if (phpClassDocument !== null) {
                            result.push({
                                uri: phpClass.fileUri,
                                range: Range.create(
                                    phpClassDocument.positionAt(literalOffset + token.position),
                                    phpClassDocument.positionAt(literalOffset + token.position + token.value.length)
                                ),
                            });
                        }
                    }

                    if (token.type === dql.TokenType.ALIASED_NAME) {
                        let [aliasPart, entityPart] = token.value.split(':');
                        let deNamespaces = this.getDoctrineEntityNamespaces();
                        if (deNamespaces[aliasPart] !== undefined) {
                            let queryFullClassName = deNamespaces[aliasPart] + '\\' + entityPart;
                            if (queryFullClassName === fullClassName) {
                                let phpClassDocument = await this.getDocument(phpClass.fileUri);
                                if (phpClassDocument !== null) {
                                    result.push({
                                        uri: phpClass.fileUri,
                                        range: Range.create(
                                            phpClassDocument.positionAt(literalOffset + token.position),
                                            phpClassDocument.positionAt(literalOffset + token.position + token.value.length)
                                        ),
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }

        return result;
    }

    private async referencesEntityField(fullClassName: string, fieldName: string): Promise<Location[]> {
        let result: Location[] = [];

        let entityClass = await this.getPhpClass(fullClassName);
        if (entityClass === null || entityClass.entity === undefined) {
            return result;
        }

        let entityDocument = await this.getDocument(entityClass.fileUri);
        if (entityDocument === null) {
            return result;
        }

        let fieldData = entityClass.entity.fields.find(row => row.name === fieldName);
        if (fieldData === undefined) {
            return result;
        }

        result.push({
            uri: entityClass.fileUri,
            range: Range.create(
                entityDocument.positionAt(fieldData.nameStartOffset),
                entityDocument.positionAt(fieldData.nameEndOffset)
            ),
        });

        for (let fileUri in this.phpClasses) {
            if (!this.isFromSourceFolders(fileUri)) {
                continue;
            }

            let phpClass = this.phpClasses[fileUri];
            if (phpClass.parsedDqlQueries === undefined) {
                continue;
            }

            for (let { literalOffset, tokens } of phpClass.parsedDqlQueries) {
                let entitiesAliases = collectEntitiesAliases(tokens, this.getEntities(), this.getDoctrineEntityNamespaces());

                for (let i = 0; i < tokens.length; i++) {
                    let token = tokens[i];
                    if (token.type !== dql.TokenType.IDENTIFIER) {
                        continue;
                    }

                    let accessPath: string[] = [token.value];
                    for (let j = i - 2; j >= 0; j -= 2) {
                        let possibleDot = tokens[j + 1];
                        let possibleIdentifier = tokens[j];

                        if (possibleDot.type === dql.TokenType.DOT) {
                            if (possibleIdentifier.type === dql.TokenType.IDENTIFIER && dql.touchEachOther(possibleIdentifier, possibleDot)) {
                                accessPath.unshift(possibleIdentifier.value);
                            } else {
                                // something wrong happened
                                accessPath.length = 0;
                                break;
                            }
                        } else {
                            break;
                        }
                    }

                    if (accessPath.length <= 1) {
                        continue;
                    }

                    if (entitiesAliases[accessPath[0]] === undefined) {
                        continue;
                    }

                    let accessResult = await this.accessEntityWithPath(entitiesAliases[accessPath[0]], accessPath.slice(1));
                    if (accessResult === null) {
                        continue;
                    }

                    if (accessResult.phpClass.fullClassName === fullClassName && accessResult.phpClassField.name === fieldName) {
                        let phpClassDocument = await this.getDocument(phpClass.fileUri);
                        if (phpClassDocument !== null) {
                            result.push({
                                uri: phpClass.fileUri,
                                range: Range.create(
                                    phpClassDocument.positionAt(literalOffset + token.position),
                                    phpClassDocument.positionAt(literalOffset + token.position + token.value.length)
                                )
                            });
                        }
                    }
                }
            }
        }

        for (let fileUri in this.templates) {
            let template = this.templates[fileUri];

            // speed optimization
            if (template.name.startsWith('@')) {
                continue;
            }

            let doc = await this.getDocument(fileUri);
            if (doc === null) {
                continue;
            }
            let code = doc.getText();
            let parsed = twigFullParse(code);
            let { tokens } = parsed;

            let initialScope = new Scope();

            let params = await this.collectRenderCallsParams(template.name);
            for (let name in params) {
                initialScope.setValue(name, params[name]);
            }

            let { names } = await findExpressionData(
                parsed,
                initialScope,
                (className: string) => this.getPhpClass(className),
                (name: string) => this.twigFunctionReturnType(name)
            );

            for (let tokenIndex in names) {
                let nameInfo = names[tokenIndex];

                if (nameInfo.type === 'classMethod') {
                    if (nameInfo.className === fullClassName && nameInfo.methodName === 'get' + fieldName[0].toUpperCase() + fieldName.substr(1)) {
                        let token = tokens[tokenIndex];

                        result.push({
                            uri: fileUri,
                            range: Range.create(
                                doc.positionAt(token.offset),
                                doc.positionAt(token.offset + token.length)
                            )
                        });
                    }
                }
            }
        }

        return result;
    }

    public async accessEntityWithPath(className: string, accessPath: string[]) {
        let phpClass = await this.getPhpClass(className);
        let entities = this.getEntities();

        for (let i = 0; i < accessPath.length; i++) {
            let name = accessPath[i];

            if (phpClass === null) {
                return null;
            }

            let entity = entities[phpClass.fullClassName];
            if (entity === undefined) {
                return null;
            }

            let fieldForName = entity.fields.find(row => row.name === name);
            if (fieldForName === undefined) {
                return null;
            }

            if (i < accessPath.length - 1) {
                if (fieldForName.isEmbedded) {
                    phpClass = await this.getPhpClass(fieldForName.type);
                } else {
                    return null;
                }
            } else {
                return { phpClass, phpClassField: fieldForName };
            }
        }

        return null;
    }

    public serviceHoverMarkdown(service: ServiceXmlDescription): string {
        let pieces = ['```'];
        if (service.class !== undefined) {
            pieces.push('class ' + service.class);
        }
        pieces.push('defined in ' + service.fileUri.substr(this.folderUri.length + 1));
        pieces.push('```');

        return pieces.join('\n');
    }

    /**
     * Find all blocks of template and its parents per block name.
     *
     * Data for every block sorted from lowest to highest parent
     */
    public collectAllTemplateBlocks(templateName: string): { [blockName: string]: TemplateBlockInfo[] } {
        let result: { [blockName: string]: TemplateBlockInfo[] } = Object.create(null);

        let parentTemplateName: string | undefined = templateName;

        for (let i = 0; i < 19; i++ /* protection from infinite cycle */) {
            if (parentTemplateName === undefined) {
                break;
            }

            let parentTemplate = this.getTemplate(parentTemplateName);
            if (parentTemplate === null) {
                break;
            }

            for (let block of parentTemplate.blocks) {
                if (result[block.name] === undefined) {
                    result[block.name] = [];
                }

                result[block.name].push(block);
            }

            if (parentTemplate.extends === undefined) {
                break;
            }

            parentTemplateName = parentTemplate.extends;
        }

        return result;
    }

    public findServiceDescription(fileUri: string, offset: number): ServiceXmlDescription | null {
        for (let serviceId in this.services) {
            let service = this.services[serviceId];
            if (service.fileUri === fileUri && service.tagStartOffset <= offset && offset <= service.tagEndOffset) {
                return service;
            }
        }

        return null;
    }

    public async routeLocation(name: string): Promise<Location | null> {
        if (this.type !== ProjectType.SYMFONY || this.symfonyReader === undefined) {
            return null;
        }

        let route = this.symfonyReader.getRoute(name);

        if (route === undefined) {
            return null;
        }

        let controller = route.controller;
        let doubleColonPosition = controller.indexOf('::');
        if (doubleColonPosition >= 0) {
            let className = controller.substring(0, doubleColonPosition);
            let methodName = controller.substr(doubleColonPosition + 2);

            return this.phpClassLocation(className, 'method', methodName);
        }

        let controllerPieces = controller.split(':');

        if (controllerPieces.length === 3) {
            let className = controllerPieces[0] + '\\Controller\\' + controllerPieces[1] + 'Controller';
            let methodName = controllerPieces[2] + 'Action';

            return this.phpClassLocation(className, 'method', methodName);
        }

        return null;
    }

    public routeHoverMarkdown(name: string): string | null {
        if (this.type !== ProjectType.SYMFONY || this.symfonyReader === undefined) {
            return null;
        }

        let route = this.symfonyReader.getRoute(name);
        if (route === undefined) {
            return null;
        }

        let hoverValue = ['```', route.path, route.controller, '```'].join('\n');

        return hoverValue;
    }

    /**
     * Tests for variables (local and global) and functions (functions, tests and filters)
     */
    public twigTestObject(documentUri: string, parsed: ParsedTwig, offset: number): TwigTestObjectResult | null {
        let { code, tokens } = parsed;

        let tokenIndex = twigTokenUnderCursor(tokens, TwigTokenType.NAME, offset);
        let i = tokenIndex;

        if (i === null) {
            return null;
        }

        if (i > 0 && twigTokenValue(code, tokens[i-1]) === '.') {
            return null;
        }

        let nameToken = tokens[i];
        let name = twigTokenValue(code, nameToken);

        let codeToCursor = code.substr(0, offset);

        let isTestPlace = /[^\w]is\s+(not\s+)?(\w*)$/.test(codeToCursor);

        let isFilterPlace = false;
        {
            if (/\|\s*(\w*)$/.test(codeToCursor)) {
                isFilterPlace = true;
            } else if (/^{%\s*filter\s+(\w*)$/.test(codeToCursor)) {
                isFilterPlace = true;
            }
        }

        // search for imported macro collections
        {
            let fileMacroImports = twigFileMacroImports(parsed);
            if (fileMacroImports[name] !== undefined) {
                return {
                    type: 'macroFileImport',
                    templateName: fileMacroImports[name],
                    hoverLeftOffset: nameToken.offset,
                    hoverRightOffset: nameToken.offset + nameToken.length,
                };
            }
        }

        // search for variables from 'render()' and 'renderView()' calls
        {
            let renderCalls = this.findRenderCallsForTemplate(documentUri);

            let calls: { callerFileUri: string; paramOffset: number; className: string; methodName: string }[] = [];

            for (let call of renderCalls) {
                for (let param of call.params) {
                    if (param.name === name) {
                        calls.push({
                            callerFileUri: call.callerUri,
                            paramOffset: param.offset,
                            className: call.className,
                            methodName: call.methodName,
                        });
                    }
                }
            }

            if (calls.length > 0) {
                return {
                    type: 'renderParams',
                    params: calls,
                    hoverLeftOffset: nameToken.offset,
                    hoverRightOffset: nameToken.offset + nameToken.length,
                };
            }
        }

        // search for globals
        {
            if (this.twigYaml !== undefined) {
                for (let global of this.twigYaml.globals) {
                    if (global.name === name) {
                        return {
                            type: 'global',
                            fileUri: this.twigYaml.uri,
                            offset: global.offset,
                            value: global.value,
                            name: global.name,
                            hoverLeftOffset: nameToken.offset,
                            hoverRightOffset: nameToken.offset + nameToken.length,
                        };
                    }
                }
            }

            for (let fileUri in this.phpClasses) {
                let phpClass = this.phpClasses[fileUri];

                if (phpClass.twigExtensionGlobals !== undefined) {
                    for (let row of phpClass.twigExtensionGlobals) {
                        if (row.name === name) {
                            return {
                                type: 'global',
                                fileUri,
                                name,
                                offset: row.nameStartOffset,
                                hoverLeftOffset: nameToken.offset,
                                hoverRightOffset: nameToken.offset + nameToken.length,
                            };
                        }
                    }
                }
            }
        }

        // search for functions, tests and filters in twig extensions
        {
            for (let fileUri in this.phpClasses) {
                let elements = this.phpClasses[fileUri].twigExtensionElements;
                if (elements === undefined) {
                    continue;
                }

                for (let element of elements) {
                    if ((isTestPlace && element.type !== 'test') || (!isTestPlace && element.type === 'test')) {
                        continue;
                    }

                    if ((isFilterPlace && element.type !== 'filter') || (!isFilterPlace && element.type === 'filter')) {
                        continue;
                    }

                    if (element.name === name) {
                        return {
                            type: 'function',
                            fileUri,
                            element,
                            hoverLeftOffset: nameToken.offset,
                            hoverRightOffset: nameToken.offset + nameToken.length,
                        };
                    }
                }
            }
        }

        return null;
    }

    public async dqlTestPosition(scalarString: nikic.Scalar_String, document: TextDocument, offset: number): Promise<DqlTestPositionResult | null> {
        // I need something like 'scalarString.valueOffset'
        let fullScalar = document.getText().substring(scalarString.attributes.startFilePos, scalarString.attributes.endFilePos + 1);

        let scalarStringValueIndex = fullScalar.indexOf(scalarString.value);
        if (scalarStringValueIndex < 0) {
            return null;
        }

        let scalarStringValueOffset = scalarString.attributes.startFilePos + scalarStringValueIndex;

        let offsetInString = offset - scalarStringValueOffset;

        let cursorTokenIndex: number | undefined;

        let tokens = dql.tokenize(scalarString.value);
        for (let i = 0; i < tokens.length; i++) {
            let t = tokens[i];
            // tokens often touch each other. filtered tokens should not touch each other.
            if (t.type === dql.TokenType.IDENTIFIER || t.type === dql.TokenType.FULLY_QUALIFIED_NAME || t.type === dql.TokenType.ALIASED_NAME) {
                if (t.position <= offsetInString && offsetInString <= t.position + t.value.length) {
                    cursorTokenIndex = i;
                    break;
                }
            }
        }

        if (cursorTokenIndex === undefined) {
            return null;
        }

        let cursorToken = tokens[cursorTokenIndex];

        let hoverLeftOffset = scalarStringValueOffset + cursorToken.position;
        let hoverRightOffset = hoverLeftOffset + cursorToken.value.length;

        if (cursorToken.type === dql.TokenType.FULLY_QUALIFIED_NAME || cursorToken.type === dql.TokenType.ALIASED_NAME) {
            let entityClass: string;

            if (cursorToken.type === dql.TokenType.FULLY_QUALIFIED_NAME) {
                entityClass = cursorToken.value;
            } else {
                let [usedAlias, usedEntity] = cursorToken.value.split(':');
                if (usedAlias === undefined || usedEntity === undefined) {
                    return null;
                }

                let deNamespaces = this.getDoctrineEntityNamespaces();

                if (deNamespaces[usedAlias] === undefined) {
                    return null;
                }

                entityClass = deNamespaces[usedAlias] + '\\' + usedEntity;
            }

            const phpClass = await this.getPhpClass(entityClass);
            if (phpClass !== null) {
                return {
                    type: 'entityClass',
                    className: entityClass,
                    hoverLeftOffset,
                    hoverRightOffset,
                };
            }
        }

        let entities = this.getEntities();

        let identifierToEntity = collectEntitiesAliases(tokens, entities, this.getDoctrineEntityNamespaces());

        let accessPath: string[] = [cursorToken.value];
        for (let i = cursorTokenIndex - 2; i >= 0; i -= 2) {
            let possibleDot = tokens[i + 1];
            let possibleIdentifier = tokens[i];

            if (possibleDot.type === dql.TokenType.DOT) {
                if (possibleIdentifier.type === dql.TokenType.IDENTIFIER && dql.touchEachOther(possibleIdentifier, possibleDot)) {
                    accessPath.unshift(possibleIdentifier.value);
                } else {
                    // something wrong happened
                    accessPath.length = 0;
                    break;
                }
            } else {
                break;
            }
        }

        if (accessPath.length <= 1) {
            return null;
        }

        if (identifierToEntity[accessPath[0]] === undefined) {
            return null;
        }

        return {
            type: 'entityField',
            className: identifierToEntity[accessPath[0]],
            accessPath: accessPath.slice(1),
            hoverLeftOffset,
            hoverRightOffset,
        };
    }

    public async phpClassHoverMarkdown(className: string, memberType?: 'method'|'constant'|'property', memberName?: string): Promise<string|null> {
        let phpClass = await this.getPhpClass(className);
        if (phpClass === null) {
            return null;
        }

        if (memberType !== undefined && memberName !== undefined) {
            if (memberType === 'method') {
                let methodInfo = phpClass.methods.filter(row => row.name === memberName)[0];

                if (methodInfo === undefined || methodInfo.shortHelp === undefined) {
                    return null;
                }

                return ['```', methodInfo.shortHelp, '```'].join('\n');

            } else if (memberType === 'constant') {
                let constantInfo = phpClass.constants.filter(row => row.name === memberName)[0];

                if (constantInfo === undefined || (constantInfo.shortHelp === undefined && constantInfo.valueText === undefined)) {
                    return null;
                }

                let pieces = ['```'];

                if (constantInfo.shortHelp !== undefined) {
                    pieces.push(constantInfo.shortHelp);
                }

                if (constantInfo.valueText !== undefined) {
                    pieces.push(`const ${constantInfo.name} = ${constantInfo.valueText};`);
                }

                pieces.push('```');

                return pieces.join('\n');
            } else if (memberType === 'property') {
                let prop = phpClass.properties.find(row => row.name === memberName);

                if (prop !== undefined) {
                    if (prop.shortHelp !== undefined) {
                        return ['```', prop.shortHelp, '```'].join('\n');
                    }
                }
            }
        } else {
            if (phpClass.shortHelp === undefined) {
                return null;
            }

            return ['```', phpClass.shortHelp, '```'].join('\n');
        }

        return null;
    }

    public async phpClassLocation(fullClassName: string, memberType?: 'method'|'constant'|'property', memberName?: string): Promise<Location|null> {
        let phpClass = await this.getPhpClass(fullClassName);
        if (phpClass === null) {
            return null;
        }

        let classDocument = await this.getDocument(phpClass.fileUri);
        if (classDocument === null) {
            return null;
        }

        if (memberType !== undefined && memberName !== undefined) {
            if (memberType === 'method') {
                let method = phpClass.methods.filter(row => row.name === memberName)[0];

                if (method !== undefined) {
                    let methodPosition = classDocument.positionAt(method.offset);

                    return {
                        uri: phpClass.fileUri,
                        range: Range.create(methodPosition, methodPosition),
                    };
                }

            } else if (memberType === 'constant') {
                let constant = phpClass.constants.filter(row => row.name === memberName)[0];

                if (constant !== undefined) {
                    let constantPosition = classDocument.positionAt(constant.offset);

                    return {
                        uri: phpClass.fileUri,
                        range: Range.create(constantPosition, constantPosition),
                    };
                }
            } else if (memberType === 'property') {
                let prop = phpClass.properties.find(row => row.name === memberName);

                if (prop !== undefined) {
                    let propPosition = classDocument.positionAt(prop.offset);

                    return {
                        uri: phpClass.fileUri,
                        range: Range.create(propPosition, propPosition),
                    };
                }
            }

        } else {
            let classPosition = classDocument.positionAt(phpClass.offset);

            return {
                uri: phpClass.fileUri,
                range: Range.create(classPosition, classPosition),
            };
        }

        return null;
    }

    public async documentChanged(action: 'createdOrChanged' | 'deleted', documentUri: string): Promise<void> {
        if (!documentUri.startsWith(this.folderUri + '/')) {
            return;
        }

        if (documentUri.startsWith(this.folderUri + '/vendor/')) {
            return;
        }

        if (documentUri.startsWith(this.folderUri + '/var/')) {
            return;
        }

        // scanning php-files
        if (this.isFromSourceFolders(documentUri) && documentUri.endsWith('.php')) {
            if (action === 'deleted') {
                delete this.phpClasses[documentUri];
            } else if (action === 'createdOrChanged') {
                do {
                    let document = await this.getDocument(documentUri);
                    if (document === null) {
                        break;
                    }

                    let code = document.getText();

                    let res = await this.scanPhpFile(documentUri, code);
                    if (res !== null) {
                        this.phpClassNameToFileUri[res.className] = documentUri;

                        if (res.phpClass !== null) {
                            this.phpClasses[documentUri] = res.phpClass;
                        }
                    }
                } while (false);
            }
        }

        // scanning twig-files
        if (documentUri.startsWith(this.templatesFolderUri + '/') && documentUri.endsWith('.twig')) {
            if (action === 'deleted') {
                delete this.templates[documentUri];
            } else if (action === 'createdOrChanged') {
                do {
                    let document = await this.getDocument(documentUri);
                    if (document === null) {
                        break;
                    }

                    let code = document.getText();

                    let templateName = documentUri.substr(this.templatesFolderUri.length + 1);

                    let descr = this.scanTwigTemplate(documentUri, templateName, code);

                    this.templates[documentUri] = descr;
                } while (false);
            }
        }

        // scanning 'config/packages/twig.yaml'
        if (documentUri === this.folderUri + '/config/packages/twig.yaml') {
            if (action === 'deleted') {
                this.twigYaml = undefined;
            } else if (action === 'createdOrChanged') {
                do {
                    let document = await this.getDocument(documentUri);
                    if (document === null) {
                        break;
                    }

                    let code = document.getText();

                    this.twigYaml = {
                        uri: documentUri,
                        globals: findTwigGlobalsInYaml(code),
                    };

                } while (false);
            }
        }

        if (documentUri === this.folderUri + '/config/services.yaml') {
            if (action === 'deleted') {
                delete this.containerParametersPositions[documentUri];
            } else if (action === 'createdOrChanged') {
                do {
                    let document = await this.getDocument(documentUri);
                    if (document === null) {
                        break;
                    }

                    let code = document.getText();

                    this.scanServicesYaml(documentUri, code);
                } while (false);
            }
        }

        if (documentUri === this.folderUri + '/composer.lock') {
            if (!this.isScanning) {
                this.scan()
                    .then(() => {})
                    .catch(() => {})
                ;
            }
        }

        if (documentUri === this.folderUri + '/config/services.yaml') {
            if (this.throttledScanContainerParameters !== undefined) {
                this.throttledScanContainerParameters();
            }
        }

        if (documentUri === this.folderUri + '/config/packages/doctrine.yaml') {
            if (this.throttledScanDoctrineEntityNamespaces !== undefined) {
                this.throttledScanDoctrineEntityNamespaces();
            }
        }

        if (this.throttledScanRoutes !== undefined) {
            this.throttledScanRoutes();
        }

        if (this.throttledScanAutowired !== undefined) {
            this.throttledScanAutowired();
        }
    }

    /**
     * Returns entity class for recognized entity repository or null if not recognized
     */
    private testEntityRepository(classNode: nikic.Stmt_Class, nameResolverData: nikic.NameResolverData): string | null {
        let parentClass = nikic.parentClass(classNode, nameResolverData);

        if (parentClass !== 'Doctrine\\Bundle\\DoctrineBundle\\Repository\\ServiceEntityRepository') {
            return null;
        }

        let methodNodes = nikic.findNodesOfType(classNode, 'Stmt_ClassMethod') as nikic.Stmt_ClassMethod[];
        let constructorNode = methodNodes.filter(node => node.name.name === '__construct')[0];
        if (constructorNode === undefined) {
            return null;
        }

        let methodCallNodes = nikic.findNodesOfType(constructorNode, 'Expr_StaticCall') as nikic.Expr_StaticCall[];

        let parentConstructorCallNode = methodCallNodes.filter((node) => {
            return node.name.nodeType === 'Identifier' && node.name.name === '__construct';
        })[0];
        if (parentConstructorCallNode === undefined) {
            return null;
        }

        if (parentConstructorCallNode.args.length < 2) {
            return null;
        }

        let secondArgValue = parentConstructorCallNode.args[1].value;

        let entityFullClassName: string | null = null;
        if (secondArgValue.nodeType === 'Expr_ClassConstFetch') {
            entityFullClassName = nikic.extractClassConstant(secondArgValue, nameResolverData);
        } else if (secondArgValue.nodeType === 'Scalar_String') {
            entityFullClassName = secondArgValue.value;
        }

        return entityFullClassName;
    }

    public async getPhpClass(fullClassName: string): Promise<PhpClass | null> {
        for (let fileUri in this.phpClasses) {
            let info = this.phpClasses[fileUri];

            if (info.fullClassName === fullClassName) {
                return info;
            }
        }

        let fileUri = this.phpClassNameToFileUri[fullClassName];
        if (fileUri !== undefined) {
            let document = await this.getDocument(fileUri);
            if (document === null) {
                return null;
            }

            let code = document.getText();
            let res = await this.scanPhpFile(fileUri, code, true);
            if (res !== null && res.phpClass !== null) {
                this.phpClasses[fileUri] = res.phpClass;
                return res.phpClass;
            }
        }

        return null;
    }

    private getBundles(): BundleInfo[] {
        let result = [];

        for (let fileUri in this.phpClasses) {
            let bundleInfo = this.phpClasses[fileUri].bundle;
            if (bundleInfo !== undefined) {
                result.push(bundleInfo);
            }
        }

        return result;
    }

    public getBundleInfo(name: string): BundleInfo | null {
        for (let fileUri in this.phpClasses) {
            let bundleInfo = this.phpClasses[fileUri].bundle;
            if (bundleInfo !== undefined && bundleInfo.name === name) {
                return bundleInfo;
            }
        }

        return null;
    }

    public getAutowiredServices(): readonly ServiceDescription[] {
        if (this.type !== ProjectType.SYMFONY || this.symfonyReader === undefined) {
            return [];
        }

        let moreServices = [];

        moreServices.push({
            fullClassName: 'Symfony\\Component\\HttpFoundation\\Request',
        });

        for (let fileUri in this.phpClasses) {
            let phpClass = this.phpClasses[fileUri];

            if (phpClass.entity !== undefined) {
                moreServices.push({ fullClassName: phpClass.fullClassName });
            }
        }

        let basicServices = this.symfonyReader.getAllAutowiredServices();

        let result = basicServices.concat(moreServices);

        return result;
    }

    public getTemplateFromUri(fileUri: string): TemplateDescription | null {
        if (this.templates[fileUri] === undefined) {
            return null;
        }

        return this.templates[fileUri];
    }

    /**
     * Gets template from template name
     *
     * @param name      For templates from bundles, can start both from '@' and '@!'
     */
    public getTemplate(name: string): TemplateDescription | null {
        if (name.startsWith('@') && name[1] !== '!') {
            let match = /^@(\w+)\//.exec(name);
            if (match !== null) {
                let bundleName = match[1];
                let pathPart = name.substr(match[0].length);
                let overrideName = 'bundles/' + bundleName + 'Bundle/' + pathPart;

                for (let fileUri in this.templates) {
                    let template = this.templates[fileUri];

                    if (template.name === overrideName) {
                        return template;
                    }
                }
            }
        }

        for (let fileUri in this.templates) {
            let template = this.templates[fileUri];

            if (template.name === name) {
                return template;
            }
        }

        return null;
    }

    private findInTemplate(code: string, tokens: TwigToken[], name: string, type: 'functionCall' | 'filterCall' | 'testCall'): number[] {
        let result: number[] = [];

        for (let i = 0; i < tokens.length; i++) {
            let token = tokens[i];

            if (token.type === TwigTokenType.NAME && twigTokenValue(code, token) === name) {
                if (type === 'functionCall') {
                    if (i > 0) {
                        let prevTokenValue = twigTokenValue(code, tokens[i-1]);

                        if (prevTokenValue === '|' || prevTokenValue === 'is' || /^is\s+not$/.test(prevTokenValue)) {
                            continue;
                        }
                    }

                    if (i + 1 < tokens.length && twigTokenValue(code, tokens[i+1]) === '(') {
                        result.push(i);
                    }
                }

                if (type === 'filterCall') {
                    if (i > 0 && twigTokenValue(code, tokens[i-1]) === '|') {
                        result.push(i);
                    } else if (i > 1 && tokens[i-2].type === TwigTokenType.BLOCK_START && twigTokenValue(code, tokens[i-1]) === 'filter') {
                        result.push(i);
                    }
                }

                if (type === 'testCall') {
                    if (i > 0) {
                        let prevTokenValue = twigTokenValue(code, tokens[i-1]);

                        if (prevTokenValue === 'is' || /^is\s+not$/.test(prevTokenValue)) {
                            result.push(i);
                        }
                    }
                }
            }
        }

        return result;
    }

    public getName(): string {
        return this.name;
    }

    public setSettingsResolver(resolver: (uri: string) => Promise<SymfonyHelperSettings|null>): void {
        this.getSettings = (): Promise<SymfonyHelperSettings | null> => resolver(this.folderUri);
    }

    /**
     * Finds return type of twig function
     *
     * Result 'null' means function not found.
     */
    public twigFunctionReturnType(functionName: string): php.Type | null {
        for (let fileUri in this.phpClasses) {
            let extensionElements = this.phpClasses[fileUri].twigExtensionElements;
            if (extensionElements === undefined) {
                continue;
            }

            for (let element of extensionElements) {
                if (element.type === 'function' && element.name === functionName) {
                    return (element.implementation !== undefined) ? element.implementation.returnType : new php.AnyType();
                }
            }
        }

        return null;
    }

    public templateName(templateUri: string): string | null {
        let relativePath = templateUri.substr(this.folderUri.length + 1);

        if (relativePath.startsWith('vendor/')) {
            let bundles = this.getBundles();
            let templateUri = this.folderUri + '/' + relativePath;

            for (let b of bundles) {
                let bundleViewsFolderUri = b.folderUri + '/Resources/views/';

                if (templateUri.startsWith(bundleViewsFolderUri)) {
                    let shortName = b.name.substr(0, b.name.length - 6);
                    return '@' + shortName + '/' + templateUri.substr(bundleViewsFolderUri.length);
                }
            }
        } else if (templateUri.startsWith(this.templatesFolderUri + '/')) {
            return templateUri.substr(this.templatesFolderUri.length + 1);
        }

        return null;
    }

    public isFromSourceFolders(fileUri: string): boolean {
        for (let folder of this.sourceFolders) {
            if (fileUri.startsWith(this.folderUri + '/' + folder + '/')) {
                return true;
            }
        }
        return false;
    }

    public isSymfony(): boolean {
        return this.type === ProjectType.SYMFONY;
    }

    public getDoctrineEntityNamespaces(): { [alias: string]: string } {
        return (this.symfonyReader === undefined) ? {} : this.symfonyReader.getAllDoctrineEntitynamespaces();
    }

    public getAllRoutes(): RouteCollection {
        return (this.symfonyReader === undefined) ? [] : this.symfonyReader.getAllRoutes();
    }

    public getAllContainerParameters(): { [name: string]: any } {
        return (this.symfonyReader === undefined) ? [] : this.symfonyReader.getAllContainerParameters();
    }

    public getContainerParameter(name: string): any {
        return (this.symfonyReader === undefined) ? undefined : this.symfonyReader.getContainerParameter(name);
    }

    public twigYamlGlobals(): string[] {
        if (this.twigYaml === undefined) {
            return [];
        }

        return this.twigYaml.globals.map(row => row.name);
    }

    public getService(id: string): ServiceXmlDescription | undefined {
        return this.services[id];
    }
}
