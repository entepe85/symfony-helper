/**
 * This file is part of the 'Symfony Helper'
 * Copyright (c) 2019 Timur Morduhai
 * Licensed under the GNU General Public License
 */
import { promisify } from 'util';
import * as child_process from 'child_process';
import * as path from 'path';
import * as querystring from 'querystring';
import { packagePath } from './utils';
import axios from 'axios';

const PARSER_REQUEST_TIMEOUT = 300 /* ms */;

// 'localhost' does not work
let HOST = '127.0.0.1';

// do I really need it?
const PARSER_CREATION_TIMEOUT = 100 /* ms */;

let PARSER_SCRIPT_DIR = path.join(packagePath, 'php-bin');

let parserProcess: child_process.ChildProcess | undefined;

let currentPort: number | undefined;
let currentPhpPath: string | undefined;

let errorCallback: ((message: string) => void) | undefined;

// this is useful during 'Project#scan()' but for 'Project#onDefinition()' error should be shown on every request.
// or should not? what if file is parsed not on every request but only after changes?
let phpParserHttpError = false;

export function cleanPhpParserHttpError(): void {
    phpParserHttpError = false;
}

export function setErrorCallback(callback: ((message: string) => void) | undefined): void {
    errorCallback = callback;
}

export function isProcessFound(): boolean {
    return parserProcess !== undefined;
}

export function stopParserProcess(): void {
    if (parserProcess !== undefined) {
        parserProcess.kill();
    }
}

export function getCurrentParserPort(): number | undefined {
    return currentPort;
}

export function getCurrentPhpPath(): string | undefined {
    return currentPhpPath;
}

/**
 * Starts/restarts parser process for php
 *
 * Possible throw error should be catched
 */
export async function restartParserProcess(port: number, phpPath: string): Promise<void> {
    if (parserProcess !== undefined) {
        parserProcess.kill();
        parserProcess = undefined;
    }

    phpParserHttpError = false;

    let newProcess = child_process.spawn(phpPath, ['-S', HOST + ':' + port, '-t', PARSER_SCRIPT_DIR], { stdio: 'ignore' });

    let startFailed = false;

    // does this event happen only during startup?
    newProcess.on('error', () => {
        startFailed = true;
    });

    await promisify(setTimeout)(PARSER_CREATION_TIMEOUT /* ms */);

    if (startFailed) {
        throw new Error('start-failed');
    } else {
        currentPort = port;
        currentPhpPath = phpPath;
        parserProcess = newProcess;
    }
}

export async function parse(code: string): Promise<null | Statement[]> {
    if (parserProcess === undefined || phpParserHttpError) {
        return null;
    }

    let response;
    try {
        response = await axios.post(
           `http://${HOST}:${currentPort}/php-parser.php`,
            querystring.stringify({ code }),
            { timeout: PARSER_REQUEST_TIMEOUT }
        );
    } catch {
        phpParserHttpError = true;
        if (errorCallback !== undefined) {
            errorCallback('Could not get response from php parser process');
        }

        return null;
    }

    let json = response.data;

    if (json === null) {
        return null;
    }

    if (!json.result || json.result !== 'success') {
        return null;
    }

    return json.ast;
}

export interface Comment {
    nodeType: 'Comment';
    text: string;
}

export interface Comment_Doc {
    nodeType: 'Comment_Doc';
    text: string;
    filePos: number;
}

export interface Attributes {
    startFilePos: number;
    endFilePos: number;

    // for 'Scalar_String': 1 for ', 2 for ", 3 for <<<X, 4 for <<<'X'
    kind?: number;

    comments?: (Comment | Comment_Doc)[];
    docLabel?: string;
}

export interface Identifier {
    nodeType: 'Identifier';
    name: string;
    attributes: Attributes;
}

export interface VarLikeIdentifier {
    nodeType: 'VarLikeIdentifier';
    name: string;
    attributes: Attributes;
}

export interface Arg {
    nodeType: 'Arg';
    value: Expression;
    attributes: Attributes;
}

export interface Param {
    nodeType: 'Param';
    type: ParamType;
    var: Expr_Variable;
    attributes: Attributes;
}

export interface Name {
    nodeType: 'Name';
    parts: string[];
    attributes: Attributes;
}

export interface Name_FullyQualified {
    nodeType: 'Name_FullyQualified';
    parts: string[];
    attributes: Attributes;
}

export interface Const {
    nodeType: 'Const';
    name: Identifier;
    value: Expression;
    attributes: Attributes;
}

export interface NullableType {
    nodeType: 'NullableType';
    type: Identifier | Name | Name_FullyQualified;
    attributes: Attributes;
}

export interface Scalar_String {
    nodeType: 'Scalar_String';
    value: string;
    attributes: Attributes;
}

export interface Expr_Variable {
    nodeType: 'Expr_Variable';
    name: string | Expression;
    attributes: Attributes;
}

export interface Expr_Array {
    nodeType: 'Expr_Array';
    items: Expr_ArrayItem[];
    attributes: Attributes;
}

export interface Expr_ArrayItem {
    nodeType: 'Expr_ArrayItem';
    key: null | Expression;
    value: Expression;
    attributes: Attributes;
}

export interface Expr_ArrayDimFetch {
    nodeType: 'Expr_ArrayDimFetch';
    var: Expression;
    dim: Expression;
    attributes: Attributes;
}

export interface Expr_Assign {
    nodeType: 'Expr_Assign';
    var: Expression;
    expr: Expression;
    attributes: Attributes;
}

export interface Expr_FuncCall {
    nodeType: 'Expr_FuncCall';
    name: Name | Name_FullyQualified | Expression;
    args: Arg[];
    attributes: Attributes;
}

export interface Expr_New {
    nodeType: 'Expr_New';
    class: Name | Name_FullyQualified | Expression;
    args: Arg[];
    attributes: Attributes;
}

export interface Expr_PropertyFetch {
    nodeType: 'Expr_PropertyFetch';
    var: Expression;
    name: Expression;
    attributes: Attributes;
}

export interface Expr_ClassConstFetch {
    nodeType: 'Expr_ClassConstFetch';
    class: Name | Name_FullyQualified;
    name: Expression | Identifier;
    attributes: Attributes;
}

export interface Expr_MethodCall {
    nodeType: 'Expr_MethodCall';
    var: Expression;
    name: Expression | Identifier;
    args: Arg[];
    attributes: Attributes;
}

export interface Expr_StaticCall {
    nodeType: 'Expr_StaticCall';
    class: Name | Name_FullyQualified;
    name: Identifier | Expr_Variable;
    args: Arg[];
    attributes: Attributes;
}

export interface Expr_Closure {
    nodeType: 'Expr_Closure';
    params: Param[];
    attributes: Attributes;
}

export interface Stmt_Expression {
    nodeType: 'Stmt_Expression';
    expr: Expression;
    attributes: Attributes;
}

export interface Stmt_Function {
    nodeType: 'Stmt_Function';
    name: Identifier;
    params: Param[];
    returnType: ReturnType;
    stmts: Statement[];
    attributes: Attributes;
}

export interface Stmt_Class {
    nodeType: 'Stmt_Class';
    flags: number;
    extends: null | Name | Name_FullyQualified;
    implements: (Name | Name_FullyQualified)[];
    name: Identifier;
    stmts: (Stmt_ClassConst | Stmt_Property | Stmt_ClassMethod)[];
    attributes: Attributes;
}

export interface Stmt_Interface {
    nodeType: 'Stmt_Interface';
    extends: Name | Name_FullyQualified;
    name: Identifier;
    stmts: (Stmt_ClassConst | Stmt_Property | Stmt_ClassMethod)[];
    attributes: Attributes;
}

// from PhpParser\Node\Stmt\Class_
export const enum ClassModifier {
    MODIFIER_PUBLIC    =  1,
    MODIFIER_PROTECTED =  2,
    MODIFIER_PRIVATE   =  4,
    MODIFIER_STATIC    =  8,
    MODIFIER_ABSTRACT  = 16,
    MODIFIER_FINAL     = 32,
}

export interface Stmt_ClassConst {
    nodeType: 'Stmt_ClassConst';
    flags: number;
    consts: Const[];
    attributes: Attributes;
}

export interface Stmt_Property {
    nodeType: 'Stmt_Property';
    flags: number;
    props: Stmt_PropertyProperty[];
    attributes: Attributes;
}

export interface Stmt_PropertyProperty {
    nodeType: 'Stmt_PropertyProperty';
    name: VarLikeIdentifier;
    default: null | Expression;
    attributes: Attributes;
}

export interface Stmt_ClassMethod {
    nodeType: 'Stmt_ClassMethod';
    flags: number;
    name: Identifier;
    params: Param[];
    returnType: ReturnType;
    stmts: Statement[];
    attributes: Attributes;
}

export interface Stmt_Namespace {
    nodeType: 'Stmt_Namespace';
    name: Name;
    stmts: Statement[];
    attributes: Attributes;
}

export interface Stmt_Use {
    nodeType: 'Stmt_Use';
    uses: Stmt_UseUse[];
    attributes: Attributes;
}

export interface Stmt_UseUse {
    nodeType: 'Stmt_UseUse';
    name: Name;
    alias: null | Identifier;
    attributes: Attributes;
}

export interface Stmt_Return {
    nodeType: 'Stmt_Return';
    expr: null | Expression;
    attributes: Attributes;
}

export type ParamType = null | Identifier | Name | Name_FullyQualified | NullableType;
export type ReturnType = ParamType;
export type Expression = Scalar_String | Expr_Array | Expr_ArrayDimFetch | Expr_Assign | Expr_FuncCall | Expr_MethodCall | Expr_StaticCall | Expr_Variable | Expr_New | Expr_PropertyFetch | Expr_ClassConstFetch | Expr_Closure;
export type Statement = Stmt_Expression | Stmt_Function | Stmt_Class | Stmt_Interface | Stmt_Namespace;

/**
 * Not very type safe and very aggressive search for nodes of selected type in node or array of nodes
 */
export function findNodesOfType(root: any, nodeType: string): any[] {
    let result: any[] = [];

    let search = (param: any): void => {
        if (param === null || param === undefined) {
            return;
        }

        if (param.nodeType !== undefined) {
            if (param.nodeType === nodeType) {
                result.push(param);
            }
            for (let key in param) {
                search(param[key]);
            }
        } else if (param.length !== undefined && typeof param === 'object' /* test for array */) {
            for (let p of param) {
                search(p);
            }
        }
    };

    search(root);

    return result;
}

/**
 * Search for 'Scalar_String' in node or array of nodes
 */
export function findStringContainingOffset(root: any, offset: number): Scalar_String | null {
    let strings = findNodesOfType(root, 'Scalar_String') as Scalar_String[];

    for (let s of strings) {
        if (s.attributes.startFilePos + 1 <= offset && offset <= s.attributes.endFilePos) {
            return s;
        }
    }

    return null;
}

interface UseStatementShort {
    offset: number;
    fullName: string;
    alias: string;
}

// support 'Stmt_GroupUse'?
export function findUseStatements(stmts: Statement[]): UseStatementShort[] {
    let result: UseStatementShort[] = [];

    let useStmts = findNodesOfType(stmts, 'Stmt_Use') as Stmt_Use[];
    for (let useStmt of useStmts) {
        let offset = useStmt.attributes.startFilePos;

        for (let useUseStmt of useStmt.uses) {
            let parts = useUseStmt.name.parts;
            let fullName = parts.join('\\');

            let alias = (useUseStmt.alias === null) ? parts[parts.length - 1] : useUseStmt.alias.name;

            result.push({ offset, fullName, alias });
        }
    }

    return result;
}

export interface NameResolverData {
    namespace: null | string;
    aliases: { [alias: string]: string };
}

export function findNameResolverData(stmts: Statement[]): NameResolverData {
    let namespaceNode = (findNodesOfType(stmts, 'Stmt_Namespace') as Stmt_Namespace[])[0];

    let namespace = (namespaceNode === undefined) ? null : namespaceNode.name.parts.join('\\');

    let uses = findUseStatements(stmts);

    let aliases: { [alias: string]: string } = {};
    for (let use of uses) {
        aliases[use.alias] = use.fullName;
    }

    return { namespace, aliases };
}

export function resolveName(nameParts: string[], data: NameResolverData): string {
    if (nameParts.length === 0) {
        throw new Error('too small array');
    }

    let firstNamePart = nameParts[0];

    if (data.aliases[firstNamePart] === undefined) {
        return (data.namespace === null) ? firstNamePart : (data.namespace + '\\' + firstNamePart);
    }

    if (data.namespace === null) {
        return nameParts.join('\\');
    }

    if (nameParts.length === 1) {
        return data.aliases[firstNamePart];
    }

    return data.aliases[firstNamePart] + '\\' + nameParts.slice(1).join('\\');
}

export function nodeText(node: Expression | Statement, code: string): string {
    return code.substring(node.attributes.startFilePos, node.attributes.endFilePos + 1);
}

export function lastDocComment(comments: undefined | (Comment | Comment_Doc)[]): null | Comment_Doc {
    if (comments === undefined) {
        return null;
    }

    for (let i = 0; i < comments.length; i++) {
        let c = comments[comments.length - 1 - i];

        if (c.nodeType === 'Comment_Doc') {
            return c;
        }
    }

    return null;
}

/**
 * Returns result of 'ClassName::const'
 */
export function extractClassConstant(expr: Expr_ClassConstFetch, nameResolverData: NameResolverData): string | null {
    if (expr.name.nodeType === 'Identifier' && expr.name.name === 'class') {
        if (expr.class.nodeType === 'Name') {
            return resolveName(expr.class.parts, nameResolverData);
        } else if (expr.class.nodeType === 'Name_FullyQualified') {
            return expr.class.parts.join('\\');
        }
    }

    return null;
}

interface MethodHeaderShort {
    leftBracketIndex: number;
    rightBracketIndex: number;
    node: Stmt_ClassMethod;
}

/**
 * Finds method containing 'offset' between '(' and ')' of argument list
 */
export function methodWithOffsetInArguments(code: string, methods: Stmt_ClassMethod[], offset: number): MethodHeaderShort | null {
    for (let node of methods) {
        if (!(node.attributes.startFilePos < offset && offset < node.attributes.endFilePos)) {
            continue;
        }

        let leftBracketIndex = code.indexOf('(', node.attributes.startFilePos);
        if (leftBracketIndex < 0 || leftBracketIndex >= node.attributes.endFilePos) {
            continue;
        }

        let rightBracketIndex = code.indexOf(')', leftBracketIndex);
        if (rightBracketIndex < 0 || rightBracketIndex >= node.attributes.endFilePos) {
            continue;
        }

        if (leftBracketIndex < offset && offset <= rightBracketIndex) {
            return {
                leftBracketIndex,
                rightBracketIndex,
                node,
            };
        }
    }

    return null;
}

export function parentClass(classNode: Stmt_Class, nameResolverData: NameResolverData): string | null {
    if (classNode.extends === null) {
        return null;
    } else if (classNode.extends.nodeType === 'Name') {
        return resolveName(classNode.extends.parts, nameResolverData);
    } else if (classNode.extends.nodeType === 'Name_FullyQualified') {
        return classNode.extends.parts.join('\\');
    } else {
        return null;
    }
}
