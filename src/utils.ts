/**
 * This file is part of the 'Symfony Helper'
 * Copyright (c) 2019 Timur Morduhai
 * Licensed under the GNU General Public License
 */
import * as util from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';

import * as glob from 'glob';
import * as mkdirp from 'mkdirp';

import axios from 'axios';
import * as querystring from 'querystring';

import {
    TextDocument,
    TextDocuments,
} from 'vscode-languageserver';

import URI from 'vscode-uri';

export let packagePath = path.join(__dirname, '../../');

export interface SymfonyHelperSettings {
    consoleHelper: {
        type: 'direct' | 'http';
        phpPath: string;
        webPath: string;
    };
    templatesFolder: string;
    sourceFolders: string[];
}

// this is for 'npm run coverage'
let forcedPackagePath = process.env.FORCE_HELPER_DIRECTORY_PATH;
if (forcedPackagePath !== undefined) {
    packagePath = forcedPackagePath;
}

export async function fileExists(filePath: string) {
    try {
        await util.promisify(fs.access)(filePath);
        return true;
    } catch {
        return false;
    }
}

export async function readFile(filePath: string) {
    return util.promisify(fs.readFile)(filePath, 'utf8');
}

export async function writeFile(filePath: string, text: string) {
    return util.promisify(fs.writeFile)(filePath, text);
}

/**
 * Creates directory (recursively if needed)
 */
export async function createDirectory(dirPath: string) {
    return util.promisify(mkdirp)(dirPath);
}

/**
 * Searches for files
 *
 * Returns strings of form 'c:/...' on windows
 */
export async function findFiles(pattern: string) {
    return util.promisify(glob)(pattern, {
        nodir: true,
    });
}

/**
 * Executes something and returns its stdout
 */
export async function exec(executable: string, args: string[]) {
    return (await util.promisify(child_process.execFile)(executable, args, { timeout: 1500 /* ms */})).stdout;
}

export class AllTextDocuments {
    private testMode: boolean;

    // 'TextDocuments' are not used during testing because its filled from IConnection
    private documents?: TextDocuments;

    private fakeFiles?: { [uri: string]: string /* uri too */ }; // Only for tests. Map from nonexisting uri to existing uri.

    private constructor(testMode: boolean, documents?: TextDocuments, fakeFiles?: { [uri: string]: string }) {
        this.testMode = testMode;
        this.documents = documents;
        this.fakeFiles = fakeFiles;
    }

    public static productionInstance(documents: TextDocuments) {
        return new AllTextDocuments(false, documents);
    }

    public static testInstance(fakeFiles: { [uri: string]: string }) {
        return new AllTextDocuments(true, undefined, fakeFiles);
    }

    public async get(uri: string): Promise<TextDocument | null> {
        if (this.documents !== undefined) {
            let document = this.documents.get(uri);
            if (document !== undefined) {
                return document;
            }
        }

        // code below used only during testing
        let filePath = URI.parse(uri).fsPath;

        if (this.testMode) {
            if (this.fakeFiles !== undefined && this.fakeFiles[uri] !== undefined) {
                filePath = URI.parse(this.fakeFiles[uri]).fsPath;
            }
        }

        try {
            let text = await readFile(filePath);

            let document = TextDocument.create(uri, 'txt', 1, text);

            return document;
        } catch {
            return null;
        }
    }
}

export interface PhpDocBlockTag {
    type: 'return' | 'var' | 'param';
    typeString: string;
    paramName?: string; // name for 'type = param'
}

function parsePhpDocBlockTag(line: string): PhpDocBlockTag | null {
    let varMatch = line.match(/^@var\s+(\S+)/);
    if (varMatch !== null) {
        let typeString = varMatch[1];
        if (typeString[0] === '$') {
            return null;
        }

        return {
            type: 'var',
            typeString,
        };
    }

    let returnMatch = line.match(/^@return\s+(\S+)/);
    if (returnMatch !== null) {
        return {
            type: 'return',
            typeString: returnMatch[1],
        };
    }

    let paramMatch = line.match(/^@param\s+(\S+)\s+\$(\S+)/);
    if (paramMatch !== null) {
        return {
            type: 'param',
            typeString: paramMatch[1],
            paramName: paramMatch[2],
        };
    }

    return null;
}

/**
 * Parse docblocks for php
 *
 * Summary can be multiline.
 * Summary, description and tags should be separated by at least one empty line.
 */
export function parsePhpDocBlock(text: string): { summary?: string, description?: string, tags: PhpDocBlockTag[] } | null {
    let processedText = text.trim();
    if (!(processedText.startsWith('/**') && processedText.endsWith('*/'))) {
        return null;
    }

    processedText = processedText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    let rawLines = processedText.split('\n');

    if (rawLines.length === 0) {
        return null;
    }

    let lines: string[] = [];
    for (let i = 0; i < rawLines.length; i++) {
        let line = rawLines[i];
        if (i === 0) {
            line = line.substr('/**'.length);
        }
        if (i === rawLines.length - 1) {
            line = line.substring(0, line.length - '*/'.length);
        }
        if (i > 0) {
            let starMatch = line.match(/^\s*\*\s*/);
            if (starMatch !== null) {
                line = line.substr(starMatch[0].length);
            }
        }
        line = line.trim();

        lines.push(line);
    }

    let state: 'summary' | 'description' | 'tags' = 'summary'; // should have prefix 'search-'. omitted for visual clarity.
    let summaryLines: string[] = [];
    let descriptionLines: string[] = [];
    let tags: PhpDocBlockTag[] = [];

    for (let line of lines) {
        if (state === 'summary') {
            if (line === '') {
                if (summaryLines.length > 0) {
                    state = 'description';
                }
            } else if (line.match(/^@[a-zA-Z]/) !== null) {
                state = 'tags';
                let tag = parsePhpDocBlockTag(line);
                if (tag !== null) {
                    tags.push(tag);
                }
            } else {
                summaryLines.push(line);
            }
        } else if (state === 'description') {
            if (line.match(/^@[a-zA-Z]/) !== null) {
                state = 'tags';
                let tag = parsePhpDocBlockTag(line);
                if (tag !== null) {
                    tags.push(tag);
                }
            } else {
                descriptionLines.push(line);
            }
        } else if (state === 'tags') {
            if (line.match(/^@[a-zA-Z]/) !== null) {
                let tag = parsePhpDocBlockTag(line);
                if (tag !== null) {
                    tags.push(tag);
                }
            }
        }
    }

    let result: { summary?: string, description?: string, tags: any[] } = {
        tags,
    };

    if (summaryLines.length > 0) {
        result.summary = summaryLines.join('\n');
    }

    while (descriptionLines.length > 0 && descriptionLines[0] === '') {
        descriptionLines.splice(0, 1);
    }
    while (descriptionLines.length > 0 && descriptionLines[descriptionLines.length - 1] === '') {
        descriptionLines.splice(descriptionLines.length - 1, 1);
    }
    if (descriptionLines.length > 0) {
        result.description = descriptionLines.join('\n');
    }

    return result;
}

export function sqlSelectFields(sql: string): string[] {
    let sqlLowerCase = sql.toLowerCase();

    let regexp = /\w+|,|\(|\)/g;

    let tokens: string[] = [];

    let match;
    do {
        match = regexp.exec(sqlLowerCase);
        if (match !== null) {
            tokens.push(match[0]);
        }
    } while (match !== null);

    if (tokens.length === 0 || tokens[0] !== 'select' || tokens.indexOf('from') < 0) {
        return [];
    }

    let result: string[] = [];

    let depth = 0; // for subqueries
    for (let i = 1; i < tokens.length; i++) {
        if (tokens[i] === '(') {
            depth++;
            continue;
        }

        if (tokens[i] === ')') {
            if (depth > 0) {
                depth--;
            }
            continue;
        }

        if (depth > 0) {
            continue;
        }

        let token = tokens[i];

        if (token === 'from') {
            break;
        }

        if (token.match(/^\w+$/) !== null) {
            if (i + 1 < tokens.length) {
                if (tokens[i+1] === ',' || tokens[i+1] === 'from') {
                    result.push(token);
                }
            }
        }
    }

    return result;
}

export async function requestHttpCommandsHelper(httpPath: string, type: 'directCommand' | 'otherCommand', message: string): Promise<string> {
    let result = await axios.post(
        httpPath,
        querystring.stringify({ type, message }),
        { timeout: 1500 /* ms */, responseType: 'text' }
    );

    // why does axios interprete my response as json?
    if (typeof result.data === 'object') {
        return JSON.stringify(result.data);
    }

    return result.data;
}
