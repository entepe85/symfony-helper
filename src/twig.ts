/**
 * This file is part of the 'Symfony Helper'
 * Copyright (c) 2019 Timur Morduhai
 * Licensed under the GNU General Public License
 */
import * as php from './php';

export const enum LexerState {
    DATA,
    BLOCK,
    VAR,
}

export const enum TokenType {
    EOF,
    TEXT,
    BLOCK_START,
    VAR_START,
    BLOCK_END,
    VAR_END,
    NAME,
    NUMBER,
    STRING,
    OPERATOR,
    PUNCTUATION,
    COMMENT_START,
    COMMENT_BODY,
    COMMENT_END,
}

export function typeToString(type: TokenType): string {
    /* tslint:disable curly */
    if (type === TokenType.EOF) return 'EOF';
    if (type === TokenType.TEXT) return 'TEXT';
    if (type === TokenType.BLOCK_START) return 'BLOCK_START';
    if (type === TokenType.VAR_START) return 'VAR_START';
    if (type === TokenType.BLOCK_END) return 'BLOCK_END';
    if (type === TokenType.VAR_END) return 'VAR_END';
    if (type === TokenType.NAME) return 'NAME';
    if (type === TokenType.NUMBER) return 'NUMBER';
    if (type === TokenType.STRING) return 'STRING';
    if (type === TokenType.OPERATOR) return 'OPERATOR';
    if (type === TokenType.PUNCTUATION) return 'PUNCTUATION';
    if (type === TokenType.COMMENT_START) return 'COMMENT_START';
    if (type === TokenType.COMMENT_BODY) return 'COMMENT_BODY';
    if (type === TokenType.COMMENT_END) return 'COMMENT_END';
    /* tslint:enable curly */
    return '';
}

export interface Token {
    readonly type: TokenType;
    readonly offset: number;
    readonly length: number;
}

function escapeRegex(s: string): string {
    // from https://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
    // Is it important that npm-package 'escape-string-regexp' uses other regexp /[|\\{}()[\]^$+*?.]/g?
    return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

const PUNCTUATION = '()[]{}?:.,|';

const OPERATORS = [
    '=',
    'not',
    '-',
    '+',
    'or',
    'and',
    'b-or',
    'b-xor',
    'b-and',
    '==',
    '!=',
    '<',
    '>',
    '>=',
    '<=',
    'not in',
    'in',
    'matches',
    'starts with',
    'ends with',
    '..',
    '+',
    '-',
    '~',
    '*',
    '/',
    '//',
    '%',
    'is',
    'is not',
    '**',
    '??',
];

// operators must be lined up from longest to shortest
OPERATORS.sort((left, right) => {
    if (left.length < right.length) {
        return 1;
    }
    if (left.length > right.length) {
        return -1;
    }
    return 0;
});

const OP_REGEXES: { [name: string]: RegExp } = {};
for (let op of OPERATORS) {
    let regexPart = '(' + escapeRegex(op) + ')';
    // an operator that ends with a character must be followed by a whitespace or a parenthesis
    if (op[op.length - 1].match(/[a-zA-Z]/) !== null) {
        regexPart += '[\\s()]';
    }
    // an operator with a space can be any amount of whitespaces
    regexPart = regexPart.replace(/\s+/g, '\\s+');

    OP_REGEXES[op] = new RegExp('^'+regexPart);
}

// differences from original
// * skips unexpected characters
// * ignores brackets
// * tokens for comments
// * doesn't support interpolation
// * doesn't throw errors
// * doesn't support multiline strings, {{}}, and {%%}
class Lexer {
    private tokens: Token[] = [];
    private code: string = '';
    private cursor: number = 0;
    private end: number = 0;
    private state: LexerState = LexerState.DATA; // review places where this member set to LexerState.DATA
    private position: number = 0;
    private positions: { offset: number, text: string }[] = []; // 'text' is '{{', '{%', '{#' with optional appended '-'

    public tokenize(code: string): Token[] {
        this.code = code;
        this.cursor = 0;
        this.end = this.code.length;
        this.tokens = [];
        this.state = LexerState.DATA;
        this.position = -1;

        let regexp = /({{|{%|{#)-?/g;
        let match;
        do {
            match = regexp.exec(this.code);
            if (match !== null) {
                this.positions.push({ offset: match.index, text: match[0] });
            }
        } while (match !== null);

        while (this.cursor < this.end) {
            // without 'as LexerState' does not work for some reason
            switch (this.state as LexerState) {
                case LexerState.DATA:
                    this.lexData();
                    break;
                case LexerState.BLOCK:
                    this.lexBlock();
                    break;
                case LexerState.VAR:
                    this.lexVar();
                    break;
            }
        }

        this.pushToken(TokenType.EOF, this.cursor, 0);

        return this.tokens;
    }

    private lexData() {
        // if no matches are left we return the rest of the template as simple text token
        if (this.position === this.positions.length - 1) {
            this.pushToken(TokenType.TEXT, this.cursor, this.end - this.cursor);
            this.cursor = this.end;
            return;
        }

        // Find the first token after the current cursor
        let twigStart = this.positions[++this.position];
        while (twigStart.offset < this.cursor) {
            if (this.position === this.positions.length - 1) {
                return;
            }
            twigStart = this.positions[++this.position];
        }

        // push the template text first
        this.pushToken(TokenType.TEXT, this.cursor, twigStart.offset - this.cursor);

        this.cursor = twigStart.offset + twigStart.text.length;

        if (twigStart.text.startsWith('{#')) {
            this.pushToken(TokenType.COMMENT_START, twigStart.offset, twigStart.text.length);
            this.lexComment();
        } else if (twigStart.text.startsWith('{%')) {
            this.pushToken(TokenType.BLOCK_START, twigStart.offset, twigStart.text.length);
            this.state = LexerState.BLOCK;
        } else if (twigStart.text.startsWith('{{')) {
            this.pushToken(TokenType.VAR_START, twigStart.offset, twigStart.text.length);
            this.state = LexerState.VAR;
        }
    }

    private lexBlock() {
        let newlinePosition = this.code.indexOf('\n', this.cursor);

        let remainingCode;
        if (newlinePosition > 0) {
            remainingCode = this.code.substring(this.cursor, newlinePosition);
        } else {
            remainingCode = this.code.substr(this.cursor);
        }

        let match;

        match = this.code.substr(this.cursor).match(/^(\s*)(-?%})/);
        if (match !== null) {
            this.pushToken(TokenType.BLOCK_END, this.cursor + match[1].length, match[2].length);
            this.cursor += match[0].length;
            this.state = LexerState.DATA;
            return;
        }

        match = remainingCode.match(/^\s*$/);
        if (match !== null) {
            this.cursor += match[0].length;
            this.state = LexerState.DATA;
            return;
        }

        this.lexExpression();
    }

    private lexVar() {
        let newlinePosition = this.code.indexOf('\n', this.cursor);

        let remainingCode;
        if (newlinePosition > 0) {
            remainingCode = this.code.substring(this.cursor, newlinePosition);
        } else {
            remainingCode = this.code.substr(this.cursor);
        }

        let match;

        match = remainingCode.match(/^(\s*)(-?}})/);
        if (match !== null) {
            this.pushToken(TokenType.VAR_END, this.cursor + match[1].length, match[2].length);
            this.cursor += match[0].length;
            this.state = LexerState.DATA;
            return;
        }

        match = remainingCode.match(/^\s*$/);
        if (match !== null) {
            this.cursor += match[0].length;
            this.state = LexerState.DATA;
            return;
        }

        this.lexExpression();
    }

    private lexExpression() {
        // regexps for 'remainingCode' must start with '^'

        let newlinePosition = this.code.indexOf('\n', this.cursor);

        let remainingCode;
        if (newlinePosition > 0) {
            remainingCode = this.code.substring(this.cursor, newlinePosition);
        } else {
            remainingCode = this.code.substr(this.cursor);
        }

        let match;

        // whitespace
        match = remainingCode.match(/^\s+/);
        if (match !== null) {
            this.cursor += match[0].length;
            if (this.cursor >= this.end) {
                this.state = LexerState.DATA;
            }
            return;
        }

        // operators
        for (let op of OPERATORS) {
            match = remainingCode.match(OP_REGEXES[op]);
            if (match !== null) {
                this.pushToken(TokenType.OPERATOR, this.cursor, match[1].length);
                this.cursor += match[0].length;
                return;
            }
        }

        // names
        match = remainingCode.match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
        if (match !== null) {
            this.pushToken(TokenType.NAME, this.cursor, match[0].length);
            this.cursor += match[0].length;
            return;
        }

        // numbers
        match = remainingCode.match(/^[0-9]+(\.[0-9]+)?/);
        if (match !== null) {
            this.pushToken(TokenType.NUMBER, this.cursor, match[0].length);
            this.cursor += match[0].length;
            return;
        }

        // punctuation
        if (PUNCTUATION.indexOf(this.code[this.cursor]) >= 0) {
            this.pushToken(TokenType.PUNCTUATION, this.cursor, 1);
            this.cursor++;
            return;
        }

        // strings
        match = remainingCode.match(/^("[^"\\]*(\\.[^"\\]*)*("|$)|'[^'\\]*(\\.[^'\\]*)*('|$))/);
        if (match !== null) {
            this.pushToken(TokenType.STRING, this.cursor, match[0].length);
            this.cursor += match[0].length;
            return;
        }

        // unexpected character
        this.cursor++;
    }

    private lexComment() {
        let commentEndPosition = this.code.indexOf('#}', this.cursor);
        if (commentEndPosition > 0) {
            if (commentEndPosition > this.cursor) {
                this.pushToken(TokenType.COMMENT_BODY, this.cursor, commentEndPosition - this.cursor);
            }
            this.pushToken(TokenType.COMMENT_END, commentEndPosition, 2);
            this.cursor = commentEndPosition + 2;
        } else {
            if (this.end > this.cursor) {
                this.pushToken(TokenType.COMMENT_BODY, this.cursor, this.end - this.cursor);
            }
            this.cursor = this.end;
        }
    }

    private pushToken(type: TokenType, offset: number, length: number) {
        if (type === TokenType.TEXT && length === 0) {
            return;
        }

        this.tokens.push({ type, offset, length });
    }
}

export function tokenize(code: string) {
    let lexer = new Lexer();
    return lexer.tokenize(code);
}

export interface TwigPiece {
    readonly type: 'comment' | 'var' | 'block';
    readonly start: number;
    readonly end: number;
    readonly startToken: number;
    readonly endToken: number;
}

export function findTwigPieces(tokens: Token[]): TwigPiece[] {
    let result: TwigPiece[] = [];

    let state: 'none' | 'comment' | 'block' | 'var' = 'none';
    let startToken = -1;

    for (let i = 0; i < tokens.length; i++) {
        let token = tokens[i];

        switch (state as string) {
            case 'none':
                if (token.type === TokenType.COMMENT_START) {
                    state = 'comment';
                    startToken = i;
                } else if (token.type === TokenType.BLOCK_START) {
                    state = 'block';
                    startToken = i;
                } else if (token.type === TokenType.VAR_START) {
                    state = 'var';
                    startToken = i;
                }
                break;
            case 'comment':
                if (token.type === TokenType.COMMENT_END || token.type === TokenType.EOF) {
                    result.push({
                        start: tokens[startToken].offset,
                        end: tokens[i].offset + tokens[i].length,
                        startToken,
                        endToken: i,
                        type: 'comment',
                    });
                    state = 'none';
                    startToken = -1;
                }
                break;
            case 'block':
                if (token.type === TokenType.BLOCK_END || token.type === TokenType.TEXT || token.type === TokenType.EOF) {
                    let endToken = (token.type === TokenType.BLOCK_END) ? i : i - 1;
                    result.push({
                        start: tokens[startToken].offset,
                        end: tokens[endToken].offset + tokens[endToken].length,
                        startToken,
                        endToken,
                        type: 'block',
                    });
                    state = 'none';
                    startToken = -1;
                }
                break;
            case 'var':
                if (token.type === TokenType.VAR_END || token.type === TokenType.TEXT || token.type === TokenType.EOF) {
                    let endToken = (token.type === TokenType.VAR_END) ? i : i - 1;
                    result.push({
                        start: tokens[startToken].offset,
                        end: tokens[endToken].offset + tokens[endToken].length,
                        startToken,
                        endToken,
                        type: 'var',
                    });
                    state = 'none';
                    startToken = -1;
                }
                break;
        }
    }

    return result;
}

/**
 * Returns full macro file imports as map from alias name to template name
 */
export function twigFileMacroImports(parsed: ParsedTwig) {
    let { code, tokens, pieces } = parsed;

    let result: { [alias: string]: string } = Object.create(null);

    for (let piece of pieces) {
        let st = piece.startToken;

        if (!(st + 4 < tokens.length
                && piece.type === 'block'
                && tokenValue(code, tokens[st+1]) === 'import'
                && tokens[st+2].type === TokenType.STRING
                && tokenValue(code, tokens[st+3]) === 'as'
                && tokens[st+4].type === TokenType.NAME)) {
            continue;
        }

        let templateNameRaw = tokenValue(code, tokens[st+2]);
        let templateName = templateNameRaw.substr(1, templateNameRaw.length - 2);

        let alias = tokenValue(code, tokens[st+4]);

        result[alias] = templateName;
    }

    return result;
}

/**
 * Returns individual macro imports created with {%from%}
 */
export function twigMacroImports(parsed: ParsedTwig) {
    let { code, tokens, pieces } = parsed;

    let result: { [alias: string]: { templateName: string, macroName: string }} = Object.create(null);

    for (let piece of pieces) {
        let st = piece.startToken;

        if (!(st + 3 < tokens.length
                && piece.type === 'block'
                && tokenValue(code, tokens[st+1]) === 'from'
                && tokens[st+2].type === TokenType.STRING
                && tokenValue(code, tokens[st+3]) === 'import')) {
            continue;
        }

        let templateNameRaw = tokenValue(code, tokens[st+2]);
        let templateName = templateNameRaw.substr(1, templateNameRaw.length - 2);

        for (let i = st + 4; i <= piece.endToken; i++) {
            let prevTokenText = tokenValue(code, tokens[i-1]);

            if (tokens[i].type === TokenType.NAME && (prevTokenText === 'import' || prevTokenText === ',')) {
                let macroName = tokenValue(code, tokens[i]);

                if (i + 1 < tokens.length && tokenValue(code, tokens[i+1]) === 'as') {
                    if (i + 2 < tokens.length && tokens[i+2].type === TokenType.NAME) {
                        let alias = tokenValue(code, tokens[i+2]);
                        result[alias] = { macroName, templateName };
                    }
                } else {
                    result[macroName] = { macroName, templateName };
                }
            }
        }
    }

    return result;
}

export function macroArguments(piece: TwigPiece, tokens: ReadonlyArray<Token>, code: string) {
    let result = [];

    for (let i = piece.startToken + 4; i <= piece.endToken; i++) {
        if (tokens[i].type === TokenType.NAME) {
            result.push({ name: tokenValue(code, tokens[i]) });
        }
    }

    return result;
}

/**
 * Returns index of found token or null.
 */
export function tokenUnderCursor(tokens: ReadonlyArray<Token>, type: TokenType, cursorOffset: number): number | null {
    for (let i = 0; i < tokens.length; i++) {
        let t = tokens[i];
        if (t.type === type) {
            if (t.offset <= cursorOffset && cursorOffset <= t.offset + t.length) {
                return i;
            }
        }
    }

    return null;
}

/**
 * Returns index of found token or null.
 */
export function stringTokenContainingCursor(tokens: ReadonlyArray<Token>, cursorOffset: number): number | null {
    for (let i = 0; i < tokens.length; i++) {
        let t = tokens[i];

        if (t.type === TokenType.STRING) {
            if (t.offset < cursorOffset && cursorOffset < t.offset + t.length) {
                return i;
            }
        }
    }
    return null;
}

export function tokenValue(orginalText: string, token: Token): string {
    return orginalText.substr(token.offset, token.length);
}

// don't forget to synchronize
type TypesOfSimplestStatementWithStatements = 'autoescape' | 'block' | 'embed' | 'filter' | 'macro' | 'sandbox' | 'spaceless' | 'verbatim' | 'with' | 'set';
export let typesOfSimplestStatementWithStatements = ['autoescape', 'block', 'embed', 'filter', 'macro', 'sandbox', 'spaceless', 'verbatim', 'with', 'set'];

export interface SimplestStatementWithStatements {
    type: TypesOfSimplestStatementWithStatements;
    startPiece: number;
    stmts: Statement[];
    endPiece?: number;
}

interface StatementFor {
    type: 'for';
    startPiece: number;
    stmts: Statement[];
    elsePart?: {
        pieceIndex: number,
        stmts: Statement[],
    };
    endPiece?: number;
}

interface StatementIf {
    type: 'if';
    startPiece: number;
    stmts: Statement[];
    elseIfParts?: { pieceIndex: number, stmts: Statement[] }[];
    elsePart?: {
        pieceIndex: number,
        stmts: Statement[],
    };
    endPiece?: number;
}

/**
 * Block of form '{% block blockName expression %}'
 */
interface StatementSimpleBlock {
    type: 'simple-block';
    pieceIndex: number;
}

interface StatementSimpleSet {
    type: 'simple-set';
    pieceIndex: number;
}

interface StatementVar {
    type: 'var';
    pieceIndex: number;
}

export type Statement =
    | SimplestStatementWithStatements
    | StatementSimpleBlock
    | StatementSimpleSet
    | StatementIf
    | StatementFor
    | StatementVar
;

function parseSimpleBlock(pieceIndex: number, piece: TwigPiece, tokens: Token[]): StatementSimpleBlock | undefined {
    // first and second tokens should be tested already.

    if (piece.endToken >= piece.startToken + 4 && tokens[piece.endToken].type === TokenType.BLOCK_END && tokens[piece.startToken + 2].type === TokenType.NAME) {
        return {
            pieceIndex,
            type: 'simple-block',
        };
    }

    return undefined;
}

function parseSimpleSet(pieceIndex: number, piece: TwigPiece, tokens: Token[]): StatementSimpleSet | undefined {
    // first and second tokens should be tested already.

    if (piece.endToken === piece.startToken + 3) {
        if (tokens[piece.startToken + 2].type === TokenType.NAME && tokens[piece.startToken + 3].type === TokenType.BLOCK_END) {
            return undefined;
        }
    }

    return {
        pieceIndex,
        type: 'simple-set',
    };
}

class Parser {
    private stack: string[] = [];
    private currentPieceIndex = 0;
    private currentPiece: TwigPiece | undefined;

    constructor(private code: string, private tokens: Token[], private pieces: TwigPiece[]) {

    }

    public parse(): Statement[] {
        if (this.pieces.length === 0) {
            return [];
        }

        this.currentPiece = this.pieces[this.currentPieceIndex];

        return this.parseStatements();
    }

    private parseStatements(): Statement[] {
        let stmts: Statement[] = [];

        do {
            if (this.currentPiece === undefined) {
                break;
            }

            if (this.currentPiece.type === 'var') {
                stmts.push({
                    type: 'var',
                    pieceIndex: this.currentPieceIndex,
                });
                this.nextPiece();
                continue;
            }

            if (this.currentPiece.type !== 'block') {
                this.nextPiece();
                continue;
            }

            let pieceName = this.currentPieceName();
            if (pieceName === null) {
                this.nextPiece();
                continue;
            }

            if (this.canCloseStatement(pieceName)) {
                break;
            }

            let stmt: Statement | undefined;

            do {
                if (pieceName === 'block') {
                    let simpleBlock = parseSimpleBlock(this.currentPieceIndex, this.currentPiece, this.tokens);
                    if (simpleBlock !== undefined) {
                        stmt = simpleBlock;
                        this.nextPiece();
                        break;
                    }
                }

                if (pieceName === 'set') {
                    let simpleSet = parseSimpleSet(this.currentPieceIndex, this.currentPiece, this.tokens);
                    if (simpleSet !== undefined) {
                        stmt = simpleSet;
                        this.nextPiece();
                        break;
                    }
                }

                if (pieceName === 'if') {
                    stmt = this.parseIf();
                } else if (pieceName === 'for') {
                    stmt = this.parseFor();
                } else if (typesOfSimplestStatementWithStatements.indexOf(pieceName) >= 0) {
                    stmt = this.parseSimplestStatementWithStatements(pieceName as TypesOfSimplestStatementWithStatements);
                } else {
                    this.nextPiece();
                }
            } while (false);

            if (stmt !== undefined) {
                stmts.push(stmt);
            }
        } while (true);

        return stmts;
    }

    private parseSimplestStatementWithStatements(name: TypesOfSimplestStatementWithStatements): SimplestStatementWithStatements {
        this.stack.push(name);
        let startPiece = this.currentPieceIndex;
        this.nextPiece();

        let stmts = this.parseStatements();

        let result: SimplestStatementWithStatements = {
            type: name,
            startPiece,
            stmts,
        };

        if (this.currentPiece === undefined) {
            this.stack.pop();
            return result;
        }

        if (this.currentPieceName() === 'end' + name) {
            result.endPiece = this.currentPieceIndex;
            this.nextPiece();
        }

        this.stack.pop();
        return result;
    }

    private parseIf(): StatementIf {
        this.stack.push('if');
        let startPiece = this.currentPieceIndex;
        this.nextPiece();

        let stmts = this.parseStatements();

        let result: StatementIf = {
            type: 'if',
            startPiece,
            stmts,
        };

        if (this.currentPiece === undefined) {
            this.stack.pop();
            return result;
        }

        let elseIfParts = [];
        while (this.currentPieceName() === 'elseif') {
            this.stack.push('elseif');
            let pieceIndex = this.currentPieceIndex;
            this.nextPiece();

            let elseIfStmts = this.parseStatements();

            elseIfParts.push({ pieceIndex, stmts: elseIfStmts });
            this.stack.pop();
        }
        if (elseIfParts.length > 0) {
            result.elseIfParts = elseIfParts;
        }

        if (this.currentPieceName() === 'else') {
            this.stack.push('else-from-if');
            let pieceIndex = this.currentPieceIndex;
            this.nextPiece();

            let elseStmts = this.parseStatements();
            result.elsePart = {
                pieceIndex,
                stmts: elseStmts,
            };

            this.stack.pop();
        }

        if (this.currentPieceName() === 'endif') {
            result.endPiece = this.currentPieceIndex;
            this.nextPiece();
        }

        this.stack.pop();
        return result;
    }

    private parseFor(): StatementFor {
        this.stack.push('for');
        let startPiece = this.currentPieceIndex;
        this.nextPiece();

        let stmts = this.parseStatements();

        let result: StatementFor = {
            type: 'for',
            startPiece,
            stmts,
        };

        if (this.currentPiece === undefined) {
            this.stack.pop();
            return result;
        }

        if (this.currentPieceName() === 'else') {
            this.stack.push('else-from-for');
            let pieceIndex = this.currentPieceIndex;
            this.nextPiece();

            let elseStmts = this.parseStatements();
            result.elsePart = {
                pieceIndex,
                stmts: elseStmts,
            };
            this.stack.pop();
        }

        if (this.currentPieceName() === 'endfor') {
            result.endPiece = this.currentPieceIndex;
            this.nextPiece();
        }

        this.stack.pop();
        return result;
    }

    private currentPieceName(): string | null {
        if (this.currentPiece === undefined || this.currentPiece.type !== 'block') {
            return null;
        }

        let piece = this.currentPiece;
        if (piece.startToken + 1 >= piece.endToken) {
            return null;
        }

        let secondToken = this.tokens[piece.startToken + 1]; // second token of 'piece'
        if (secondToken.type !== TokenType.NAME) {
            return null;
        }

        let secondTokenValue = tokenValue(this.code, secondToken);

        return secondTokenValue;
    }

    private nextPiece() {
        if (this.currentPieceIndex >= this.pieces.length) {
            return;
        }

        this.currentPieceIndex++;
        this.currentPiece = this.pieces[this.currentPieceIndex];
    }

    private canCloseStatement(pieceName: string): boolean {
        for (let i = this.stack.length - 1; i >= 0; i--) {
            let parent = this.stack[i];

            if (typesOfSimplestStatementWithStatements.indexOf(parent) >= 0) {
                if (pieceName === 'end' + parent) {
                    return true;
                }
            } else if (parent === 'if') {
                if (pieceName === 'elseif' || pieceName === 'else' || pieceName === 'endif') {
                    return true;
                }
            } else if (parent === 'elseif') {
                if (pieceName === 'elseif' || pieceName === 'else' || pieceName === 'endif') {
                    return true;
                }
            } else if (parent === 'else-from-if') {
                if (pieceName === 'else' || pieceName === 'elseif') {
                    // this allows multiple 'else' and 'elseif' in {%if%}
                    return false;
                }
                if (pieceName === 'endif') {
                    return true;
                }
            } else if (parent === 'for') {
                if (pieceName === 'endfor' || pieceName === 'else') {
                    return true;
                }
            } else if (parent === 'else-from-for') {
                if (pieceName === 'else') {
                    // this allows multiple 'else' in {%for%}
                    return false;
                }
                if (pieceName === 'endfor') {
                    return true;
                }
            }
        }

        return false;
    }
}

export function parse(code: string, tokens: Token[], pieces: TwigPiece[]) {
    let parser = new Parser(code, tokens, pieces);

    return parser.parse();
}

/**
 * Returns deepest statement containing offset with restriction that offset not in any piece
 */
export function deepestStatement(stmts: ReadonlyArray<Statement>, offset: number, pieces: ReadonlyArray<TwigPiece>, piecesTested: boolean = false): Statement | null {
    // not all 'pieces' are in 'stmts'
    if (!piecesTested) {
        for (let p of pieces) {
            if (p.start < offset && offset < p.end) {
                return null;
            }
        }
    }

    if (stmts.length === 0) {
        return null;
    }

    let firstStmt = stmts[0];
    if (firstStmt.type === 'simple-block' || firstStmt.type === 'simple-set' || firstStmt.type === 'var') {
        if (offset <= pieces[firstStmt.pieceIndex].start) {
            return null;
        }
    } else {
        if (offset <= pieces[firstStmt.startPiece].start) {
            return null;
        }
    }

    let candidate: Statement | undefined;
    for (let stmt of stmts) {
        if (stmt.type === 'simple-block' || stmt.type === 'simple-set' || stmt.type === 'var') {
            continue;
        }

        let isCandidate;
        if (stmt.endPiece === undefined) {
            // this works because 'stmt' without 'endPiece' must be last statement in array of statements
            isCandidate = pieces[stmt.startPiece].end <= offset;
        } else {
            isCandidate = pieces[stmt.startPiece].end <= offset && offset <= pieces[stmt.endPiece].start;
        }

        if (isCandidate) {
            candidate = stmt;
            break;
        }
    }

    if (candidate === undefined || candidate.type === 'simple-block' || candidate.type === 'simple-set' || candidate.type === 'var') {
        return null;
    }

    if (typesOfSimplestStatementWithStatements.indexOf(candidate.type) >= 0) {
        return deepestStatement(candidate.stmts, offset, pieces, true) || candidate;
    }

    if (candidate.type === 'for') {
        if (candidate.elsePart !== undefined) {
            if (pieces[candidate.elsePart.pieceIndex].end <= offset) {
                return deepestStatement(candidate.elsePart.stmts, offset, pieces, true) || candidate;
            }
        }

        return deepestStatement(candidate.stmts, offset, pieces, true) || candidate;

    }

    if (candidate.type === 'if') {
        if (candidate.elsePart !== undefined) {
            if (pieces[candidate.elsePart.pieceIndex].end <= offset) {
                return deepestStatement(candidate.elsePart.stmts, offset, pieces, true) || candidate;
            }
        }

        if (candidate.elseIfParts !== undefined) {
            let lastElseIfPart;

            for (let stmt of candidate.elseIfParts) {
                if (pieces[stmt.pieceIndex].end <= offset) {
                    lastElseIfPart = stmt;
                } else {
                    break;
                }
            }

            if (lastElseIfPart !== undefined) {
                return deepestStatement(lastElseIfPart.stmts, offset, pieces, true) || candidate;
            }
        }

        return deepestStatement(candidate.stmts, offset, pieces, true) || candidate;
    }

    return null;
}

export interface ScopeValues {
    [name: string]: php.Type;
}

export class Scope {
    private parent?: Scope;

    private values: ScopeValues = Object.create(null);

    public constructor(parent?: Scope) {
        this.parent = parent;
    }

    public setValue(name: string, type: php.Type) {
        this.values[name] = type;
    }

    public getOwnValues() {
        let result: ScopeValues = Object.create(null);

        for (let name in this.values) {
            result[name] = this.values[name];
        }

        return result;
    }

    public getAllValues() {
        let result: ScopeValues;

        if (this.parent === undefined) {
            result = Object.create(null);
        } else {
            result = this.parent.getOwnValues();
        }

        for (let name in this.values) {
            result[name] = this.values[name];
        }

        return result;
    }
}

type TreeWalkerCallback = (scope: Scope, pieceIndex: number) => void;

export type AccessPathElement =
    | { type: 'name', tokenIndex: number}
    | { type: '.', tokenIndex: number }
    | { type: '(', startTokenIndex: number, endTokenIndex?: number, commaTokenIndexes: number[] }
    | { type: '[', startTokenIndex: number, endTokenIndex?: number }
;

// represents variable, function call or access to variable or result of function call
// first element must always be of type 'name'
type ExpressionAccessPath = AccessPathElement[];

/**
 * Collects expressions of form 'name[].name().name()[].'
 */
export function parseExpression(code: string, tokens: ReadonlyArray<Token>, firstToken: number, lastToken: number) {
    let accessPaths: ExpressionAccessPath[] = [];
    let subExpressions: { firstToken: number, lastToken: number }[] = [];

    let currentTokenIndex = firstToken;

    while (true) {
        if (currentTokenIndex > lastToken) {
            break;
        }

        let currentToken = tokens[currentTokenIndex];

        // collect expressions of form 'name[].name().name()[].'
        if (currentToken.type === TokenType.NAME) {
            let accessPath: ExpressionAccessPath = [];

            accessPaths.push(accessPath);
            accessPath.push({ type: 'name', tokenIndex: currentTokenIndex });

            currentTokenIndex++;
            if (currentTokenIndex > lastToken) {
                break;
            }

            while (true) {
                // collect '(...)' and '[...]'
                while (true) {
                    if (currentTokenIndex > lastToken) {
                        break;
                    }

                    let currentTokenValue = tokenValue(code, tokens[currentTokenIndex]);
                    if (currentTokenValue === '(') {
                        let depth = 1;
                        let closingBraceIndex: number | undefined;
                        let commas: number[] = [];
                        for (let j = currentTokenIndex + 1; j <= lastToken; j++) {
                            let tv = tokenValue(code, tokens[j]);
                            if (tv === '(') {
                                depth++;
                            } else if (tv === ')') {
                                depth--;
                                if (depth === 0) {
                                    closingBraceIndex = j;
                                    break;
                                }
                            } else if (tv === ',') {
                                if (depth === 1) {
                                    commas.push(j);
                                }
                            }
                        }

                        let newElement: AccessPathElement = { type: '(', startTokenIndex: currentTokenIndex, commaTokenIndexes: commas };
                        if (closingBraceIndex !== undefined) {
                            newElement.endTokenIndex = closingBraceIndex;
                        }
                        accessPath.push(newElement);

                        let subExpressionSeparators: number[] = [currentTokenIndex];
                        for (let commaIndex of commas) {
                            subExpressionSeparators.push(commaIndex);
                        }
                        subExpressionSeparators.push((closingBraceIndex===undefined)?(lastToken+1):closingBraceIndex);
                        for (let i = 0; i < subExpressionSeparators.length - 1; i++) {
                            if (subExpressionSeparators[i] + 1 <= subExpressionSeparators[i+1] - 1) {
                                subExpressions.push({ firstToken: subExpressionSeparators[i] + 1, lastToken: subExpressionSeparators[i+1] - 1 });
                            }
                        }

                        currentTokenIndex = (closingBraceIndex === undefined) ? (lastToken + 1) : (closingBraceIndex + 1);

                    } else if (currentTokenValue === '[') {
                        let depth = 1;
                        let closingBraceIndex: number | undefined;
                        for (let j = currentTokenIndex + 1; j <= lastToken; j++) {
                            let tv = tokenValue(code, tokens[j]);
                            if (tv === '[') {
                                depth++;
                            } else if (tv === ']') {
                                depth--;
                                if (depth === 0) {
                                    closingBraceIndex = j;
                                    break;
                                }
                            }
                        }

                        let newElement: AccessPathElement = { type: '[', startTokenIndex: currentTokenIndex };
                        if (closingBraceIndex !== undefined) {
                            newElement.endTokenIndex = closingBraceIndex;
                        }
                        accessPath.push(newElement);

                        if (closingBraceIndex === undefined) {
                            if (currentTokenIndex + 1 <= lastToken) {
                                subExpressions.push({ firstToken: currentTokenIndex + 1, lastToken });
                            }
                        } else {
                            if (currentTokenIndex + 1 <= closingBraceIndex - 1) {
                                subExpressions.push({ firstToken: currentTokenIndex + 1, lastToken: closingBraceIndex - 1});
                            }
                        }
                        currentTokenIndex = (closingBraceIndex === undefined) ? (lastToken + 1) : (closingBraceIndex + 1);

                    } else {
                        break;
                    }
                }

                if (currentTokenIndex > lastToken) {
                    break;
                }

                // collect '.'
                if (tokenValue(code, tokens[currentTokenIndex]) === '.') {
                    accessPath.push({ type: '.', tokenIndex: currentTokenIndex });
                } else {
                    break;
                }

                currentTokenIndex++;
                if (currentTokenIndex > lastToken) {
                    break;
                }

                // collect 'name' after '.'
                if (tokens[currentTokenIndex].type === TokenType.NAME) {
                    accessPath.push({ type: 'name', tokenIndex: currentTokenIndex });
                } else {
                    break;
                }

                currentTokenIndex++;
                if (currentTokenIndex > lastToken) {
                    break;
                }
            }
        } else {
            currentTokenIndex++;
        }
    }

    for (let expr of subExpressions) {
        let subResult = parseExpression(code, tokens, expr.firstToken, expr.lastToken);
        for (let row of subResult.accessPaths) {
            accessPaths.push(row);
        }
    }

    return { accessPaths };
}

interface ExpressionData {
    names: { [tokenIndex: number]: ExpressionNameInfo };
    dots: { [tokenIndex: number]: { typeBefore: php.Type }};
}

type ExpressionNameInfo =
    | { type: 'variable', phpType: php.Type }
    | { type: 'classMethod', className: string, methodName: string }
    | { type: 'classProperty', className: string, propertyName: string }
;

// result 'null' means function not found
type FunctionTypeResolver = (name: string) => php.Type | null;

// right now it's one time usage class
class TreeWalker {
    private stmts: ReadonlyArray<Statement>;
    private pieces: ReadonlyArray<TwigPiece>;
    private tokens: ReadonlyArray<Token>;
    private code: string;
    private initialScope: Scope;
    private expressionData: ExpressionData = { names: {}, dots: {} };
    private phpClassInfoResolver: php.PhpClassMoreInfoResolver;
    private functionTypeResolver: FunctionTypeResolver;

    public constructor(parsed: ParsedTwig, initialScope: Scope, phpClassInfoResolver: php.PhpClassMoreInfoResolver, functionTypeResolver: FunctionTypeResolver) {
        this.stmts = parsed.stmts;
        this.pieces = parsed.pieces;
        this.tokens = parsed.tokens;
        this.code = parsed.code;
        this.initialScope = initialScope;
        this.phpClassInfoResolver = phpClassInfoResolver;
        this.functionTypeResolver = functionTypeResolver;
    }

    public async getValues(offset: number) {
        let result: ScopeValues | undefined;

        let callback = (scope: Scope, pieceIndex: number) => {
            let piece = this.pieces[pieceIndex];

            if (result === undefined && piece.start + 2 <= offset && offset <= piece.end) {
                result = scope.getAllValues();
            }
        };

        await this.processNodes(this.stmts, this.initialScope, callback);

        return result;
    }

    public async getExpressionData() {
        await this.processNodes(this.stmts, this.initialScope, () => {});
        return this.expressionData;
    }

    private async processNodes(stmts: ReadonlyArray<Statement>, scope: Scope, callback: TreeWalkerCallback) {
        for (let stmt of stmts) {
            await this.processNode(stmt, scope, callback);
        }
    }

    /**
     * Changes 'scope' according to 'stmt'
     */
    private async processNode(stmt: Statement, scope: Scope, callback: TreeWalkerCallback) {
        if (stmt.type === 'var') {
            callback(scope, stmt.pieceIndex);

            let piece = this.pieces[stmt.pieceIndex];

            if (piece.startToken + 1 <= piece.endToken) {
                await this.processExpression(piece.startToken + 1, piece.endToken, scope);
            }
        } else if (stmt.type === 'simple-set') {
            callback(scope, stmt.pieceIndex);

            let piece = this.pieces[stmt.pieceIndex];

            if (piece.startToken + 3 <= piece.endToken && this.tokens[piece.startToken + 2].type === TokenType.NAME && this.tokenValue(piece.startToken + 3) === '=') {
                let name = this.tokenValue(piece.startToken + 2);

                let type: php.Type | undefined;

                if (piece.startToken + 4 <= piece.endToken) {
                    type = await this.processExpression(piece.startToken + 4, piece.endToken, scope);
                }

                scope.setValue(name, type || new php.AnyType());
            } else {
                // multiassignment {% set x, y, z = ... %}
                let expectName = true;
                for (let i = piece.startToken + 2; i <= piece.endToken; i++) {
                    let t = this.tokens[i];
                    if (expectName) {
                        if (t.type === TokenType.NAME) {
                            let name = this.tokenValue(i);
                            scope.setValue(name, new php.AnyType());
                        } else {
                            break;
                        }
                    } else {
                        let value = this.tokenValue(i);
                        if (value !== ',') {
                            break;
                        }
                    }
                    expectName = !expectName;
                }
            }
        } else if (stmt.type === 'if') {
            callback(scope, stmt.startPiece);
            let startPiece = this.pieces[stmt.startPiece];
            if (startPiece.startToken + 2 <= startPiece.endToken) {
                await this.processExpression(startPiece.startToken + 2, startPiece.endToken, scope);
            }
            await this.processNodes(stmt.stmts, scope, callback);

            if (stmt.elseIfParts !== undefined) {
                for (let elseIfPart of stmt.elseIfParts) {
                    callback(scope, elseIfPart.pieceIndex);
                    let elseIfPiece = this.pieces[elseIfPart.pieceIndex];
                    if (elseIfPiece.startToken + 2 <= elseIfPiece.endToken) {
                        await this.processExpression(elseIfPiece.startToken + 2, elseIfPiece.endToken, scope);
                    }
                    await this.processNodes(elseIfPart.stmts, scope, callback);
                }
            }

            if (stmt.elsePart !== undefined) {
                callback(scope, stmt.elsePart.pieceIndex);
                await this.processNodes(stmt.elsePart.stmts, scope, callback);
            }
        } else if (stmt.type === 'for') {
            callback(scope, stmt.startPiece);

            let newScope = new Scope(scope);

            let piece = this.pieces[stmt.startPiece];
            if (piece.startToken + 2 <= piece.endToken && this.tokens[piece.startToken + 2].type === TokenType.NAME) {
                let name = this.tokenValue(piece.startToken + 2);

                let expressionType: php.Type;
                if (piece.startToken + 4 <= piece.endToken && this.tokenValue(piece.startToken + 3) === 'in') {
                    expressionType = await this.processExpression(piece.startToken + 4, piece.endToken, scope);
                } else {
                    expressionType = new php.AnyType();
                }

                let elementType = (expressionType instanceof php.ArrayType) ? expressionType.getValueType() : new php.AnyType();

                newScope.setValue(name, elementType);
            }

            await this.processNodes(stmt.stmts, newScope, callback);
        } else if (stmt.type === 'simple-block') {
            callback(scope, stmt.pieceIndex);
            let piece = this.pieces[stmt.pieceIndex];
            if (piece.startToken + 3 <= piece.endToken) {
                await this.processExpression(piece.startToken + 3, piece.endToken, scope);
            }
        } else if (stmt.type === 'verbatim') {
            // do nothing
        } else if (stmt.type === 'block') {
            callback(scope, stmt.startPiece);
            await this.processNodes(stmt.stmts, new Scope(scope), callback);
        } else if(stmt.type === 'macro') {
            callback(scope, stmt.startPiece);

            let newScope = new Scope(scope);

            let args = macroArguments(this.pieces[stmt.startPiece], this.tokens, this.code);
            for (let arg of args) {
                newScope.setValue(arg.name, new php.AnyType());
            }

            await this.processNodes(stmt.stmts, newScope, callback);
        } else {
            callback(scope, stmt.startPiece);
            await this.processNodes(stmt.stmts, scope, callback);
        }
    }

    /**
     * Collects information about expression (types of identifiers, function calls, ...) and returns its type
     *
     * Last token can be BLOCK_END or VAR_END
     */
    private async processExpression(firstToken: number, lastToken0: number, scope: Scope): Promise<php.Type> {
        let lastToken = lastToken0;
        if (this.tokens[lastToken].type === TokenType.BLOCK_END || this.tokens[lastToken].type === TokenType.VAR_END) {
            lastToken--;
        }

        if (firstToken > lastToken) {
            return new php.AnyType();
        }

        let vars = scope.getAllValues();

        let { accessPaths } = parseExpression(this.code, this.tokens, firstToken, lastToken);

        let { names: namesData, dots: dotsData } = this.expressionData;

        let expressionType: php.Type | undefined;

        for (let i = 0; i < accessPaths.length; i++) {
            let accessPath = accessPaths[i];
            let accessPathPrefixType = new php.AnyType();

            access_elements_loop:
            for (let ii = 0; ii < accessPath.length; ii++) {
                let accessElement  = accessPath[ii];

                if (ii === 0) {
                    if (accessElement.type !== 'name') {
                        break;
                    }

                    let name = this.tokenValue(accessElement.tokenIndex);

                    let phpType: php.Type;

                    do {
                        if (vars[name] !== undefined) {
                            phpType = vars[name];
                            namesData[accessElement.tokenIndex] = { type: 'variable', phpType };
                            break;
                        }

                        let t = this.functionTypeResolver(name);
                        if (t !== null) {
                            phpType = t;
                            break;
                        }

                        phpType = new php.AnyType();
                        namesData[accessElement.tokenIndex] = { type: 'variable', phpType };
                    } while (false);

                    accessPathPrefixType = phpType;
                    continue;
                }

                if (accessElement.type === '.') {
                    dotsData[accessElement.tokenIndex] = { typeBefore: accessPathPrefixType };
                }

                if (accessElement.type === 'name' && accessPath[ii-1].type === '.') {
                    if (accessPathPrefixType instanceof php.ObjectType) {
                        let className = accessPathPrefixType.getClassName();

                        let moreClassInfo = await this.phpClassInfoResolver(className);
                        if (moreClassInfo !== null) {
                            let tokenText = this.tokenValue(accessElement.tokenIndex);

                            // search for class property
                            for (let p of moreClassInfo.properties) {
                                if (p.name === tokenText && p.isPublic) {
                                    namesData[accessElement.tokenIndex] = { type: 'classProperty', className, propertyName: tokenText };
                                    accessPathPrefixType = p.type;
                                    continue access_elements_loop;
                                }
                            }

                            // search for class method
                            for (let m of moreClassInfo.methods) {
                                if (m.name === tokenText && m.isPublic) {
                                    namesData[accessElement.tokenIndex] = { type: 'classMethod', className, methodName: m.name };
                                    accessPathPrefixType = m.returnType;
                                    continue access_elements_loop;
                                }
                            }

                            // search for class method of form get*, is*, has*
                            for (let prefix of ['get', 'is', 'has']) {
                                for (let m of moreClassInfo.methods) {
                                    if ((m.name === prefix + tokenText[0].toUpperCase() + tokenText.substr(1)) && m.isPublic) {
                                        namesData[accessElement.tokenIndex] = { type: 'classMethod', className, methodName: m.name };
                                        accessPathPrefixType = m.returnType;
                                        continue access_elements_loop;
                                    }
                                }
                            }
                        }
                    }
                }

                if (accessElement.type === '[') {
                    if (accessPathPrefixType instanceof php.ArrayType) {
                        accessPathPrefixType = accessPathPrefixType.getValueType();
                    }
                }
            }

            if (i === 0 /* it should also check that first accessPath spans all expression */) {
                expressionType = accessPathPrefixType;
            }
        }

        return (expressionType === undefined) ? new php.AnyType() : expressionType;
    }

    private tokenValue(tokenIndex: number) {
        return tokenValue(this.code, this.tokens[tokenIndex]);
    }
}

export async function findVariables(parsed: ParsedTwig, offset: number, initialScope: Scope, phpClassInfoResolver: php.PhpClassMoreInfoResolver, functionTypeResolver: FunctionTypeResolver) {
    let treeWalker = new TreeWalker(parsed, initialScope, phpClassInfoResolver, functionTypeResolver);
    let result = await treeWalker.getValues(offset);
    return result;
}

export async function findExpressionData(parsed: ParsedTwig, initialScope: Scope, phpClassInfoResolver: php.PhpClassMoreInfoResolver, functionTypeResolver: FunctionTypeResolver) {
    let treeWalker = new TreeWalker(parsed, initialScope, phpClassInfoResolver, functionTypeResolver);
    let result = await treeWalker.getExpressionData();
    return result;
}

export interface ParsedTwig {
    readonly code: string;
    readonly tokens: ReadonlyArray<Token>;
    readonly pieces: ReadonlyArray<TwigPiece>;
    readonly stmts: ReadonlyArray<Statement>;
}

export function fullParse(code: string): ParsedTwig {
    let tokens = tokenize(code);
    let pieces = findTwigPieces(tokens);

    let parser = new Parser(code, tokens, pieces);
    let stmts = parser.parse();

    return {
        code,
        tokens,
        pieces,
        stmts,
    };
}
