/**
 * This file is part of the 'Symfony Helper'
 * Copyright (c) 2019 Timur Morduhai
 * Licensed under the GNU General Public License
 */
export const enum TokenType {
    ALIASED_NAME,
    FULLY_QUALIFIED_NAME,
    IDENTIFIER,
    NUMBER,
    STRING,
    INPUT_PARAMETER,
    DOT,
    JOIN,
    FROM,
}

let patterns = [
    '[a-z_][a-z0-9_]*\\:[a-z_][a-z0-9_]*(?:\\\\[a-z_][a-z0-9_]*)*', // aliased name
    '[a-z_\\\\][a-z0-9_]*(?:\\\\[a-z_][a-z0-9_]*)*', // identifier or qualified name
    '(?:[0-9]+(?:[\\.][0-9]+)*)(?:e[+-]?[0-9]+)?', // numbers
    "'(?:[^']|'')*'", // quoted strings
    '\\?[0-9]*|:[a-z_][a-z0-9_]*', // parameters
    '\\.', // dot
];

let tokenRegexps = patterns.map(str => new RegExp('^' + str + '$', 'ig'));

export interface Token {
    readonly value: string;
    readonly type: number;
    readonly position: number;
}

function getType(value: string): TokenType | null {
    // strings
    if (value[0] === '\'') {
        return TokenType.STRING;
    }

    // input parameters
    if (value[0] === '?' || value[0] === ':') {
        return TokenType.INPUT_PARAMETER;
    }

    // dot
    if (value === '.') {
        return TokenType.DOT;
    }

    // numbers
    if (value.match(tokenRegexps[2]) !== null) {
        return TokenType.NUMBER;
    }

    // identifiers, aliased names, qualified names, keywords
    if (value[0].match(/[a-zA-Z]/) !== null || value[0] === '_' || value[0] === '\\') {
        if (value.toLowerCase() === 'join') {
            return TokenType.JOIN;
        }

        if (value.toLowerCase() === 'from') {
            return TokenType.FROM;
        }

        if (value.indexOf(':') !== -1) {
            return TokenType.ALIASED_NAME;
        }

        if (value.indexOf('\\') !== -1) {
            return TokenType.FULLY_QUALIFIED_NAME;
        }

        return TokenType.IDENTIFIER;
    }

    return null;
}

export function tokenize(input: string): Token[] {
    let regex = new RegExp(
        '((' + patterns.join(')|(') + '))',
        'ig'
    );

    let matches = [];
    {
        let match;
        do {
            match = regex.exec(input);
            if (match !== null && match[1] !== undefined) {
                matches.push({
                    value: match[1],
                    position: match.index,
                });
            }
        } while(match !== null);
    }

    let tokens: Token[] = [];

    for (let match of matches) {
        let type = getType(match.value);
        if (type === null) {
            continue;
        }

        tokens.push({
            position: match.position,
            type: type,
            value: match.value,
        });
    }

    return tokens;
}

// it's needed because I skip some tokens (braces, commas, ...)
export function touchEachOther(...tokens: Token[]): boolean {
    if (tokens.length <= 1) {
        return true;
    }

    for (let i = 0; i < tokens.length - 1; i++) {
        if (tokens[i].position + tokens[i].value.length !== tokens[i+1].position) {
            return false;
        }
    }

    return true;
}
