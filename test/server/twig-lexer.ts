import * as assert from 'assert';
import { tokenize, typeToString, Token, TokenType } from '../../src/twig';

describe('twig lexer', function () {
    it('should work', function () {
        let fixtures: { text: string, expectedTokenTypes: string[], fullTokens?: { [index: number]: Token } }[] = [
            {
                text: 'some text',
                expectedTokenTypes: ['TEXT', 'EOF'],
                fullTokens: {
                    0: { type: TokenType.TEXT, offset: 0, length: 9 },
                },
            },
            {
                text: '{{}}{{--}}',
                expectedTokenTypes: ['VAR_START', 'VAR_END', 'VAR_START', 'VAR_END', 'EOF'],
                fullTokens: {
                    1: { type: TokenType.VAR_END, offset: 2, length: 2 },
                },
            },
            {
                text: '{%--%}{%%}',
                expectedTokenTypes: ['BLOCK_START', 'BLOCK_END', 'BLOCK_START', 'BLOCK_END', 'EOF'],
                fullTokens: {
                    0: { type: TokenType.BLOCK_START, offset: 0, length: 3 },
                    1: { type: TokenType.BLOCK_END, offset: 3, length: 3 },
                },
            },
            {
                text: '{{ var . z [ 12 ] }}',
                expectedTokenTypes: ['VAR_START', 'NAME', 'PUNCTUATION', 'NAME', 'PUNCTUATION', 'NUMBER', 'PUNCTUATION', 'VAR_END', 'EOF'],
                fullTokens: {
                    1: { type: TokenType.NAME, offset: 3, length: 3 },
                },
            },
            {
                text: '{{ a+3==b }}',
                expectedTokenTypes: ['VAR_START', 'NAME', 'OPERATOR', 'NUMBER', 'OPERATOR', 'NAME', 'VAR_END', 'EOF'],
                fullTokens: {
                    4: { type: TokenType.OPERATOR, offset: 6, length: 2 },
                }
            },
            {
                text: '{{ value not  in  set }}',
                expectedTokenTypes: ['VAR_START', 'NAME', 'OPERATOR', 'NAME', 'VAR_END', 'EOF'],
                fullTokens: {
                    2: { type: TokenType.OPERATOR, offset: 9, length: 7 },
                },
            },
            {
                text: `{{ 'a"\\'' "b'\\"" }}`,
                expectedTokenTypes: ['VAR_START', 'STRING', 'STRING', 'VAR_END', 'EOF'],
                fullTokens: {
                    1: { type: TokenType.STRING, offset: 3, length: 6 },
                    2: { type: TokenType.STRING, offset: 10, length: 6 },
                }
            },
            {
                text: `{{ '  }}' }}`,
                expectedTokenTypes: ['VAR_START', 'STRING', 'VAR_END', 'EOF'],
            },
            {
                text: `{{ '  %}' }}`,
                expectedTokenTypes: ['VAR_START', 'STRING', 'VAR_END', 'EOF'],
            },
            {
                text: `{{ '{%' }}`,
                expectedTokenTypes: ['VAR_START', 'STRING', 'VAR_END', 'EOF'],
            },
            {
                text: `{{ '{#' }}`,
                expectedTokenTypes: ['VAR_START', 'STRING', 'VAR_END', 'EOF'],
            },
            {
                text: `{% '   %}' %}`,
                expectedTokenTypes: ['BLOCK_START', 'STRING', 'BLOCK_END', 'EOF'],
            },
            {
                text: `{% ' \\'  }}' %}`,
                expectedTokenTypes: ['BLOCK_START', 'STRING', 'BLOCK_END', 'EOF'],
            },
        ];

        // fixtures for behavior not corresponding to original
        let otherFixtures: typeof fixtures = [
            {
                // string interpolation is not implemented
                text: '{{ "#{var}" }}',
                expectedTokenTypes: ['VAR_START', 'STRING', 'VAR_END', 'EOF'],
            },
            {
                text: 'text{##}text',
                expectedTokenTypes: ['TEXT', 'COMMENT_START', 'COMMENT_END', 'TEXT', 'EOF'],
                fullTokens: {
                    0: { type: TokenType.TEXT, offset: 0, length: 4 },
                    3: { type: TokenType.TEXT, offset: 8, length: 4 },
                },
            },
            {
                text: '{# xxx',
                expectedTokenTypes: ['COMMENT_START', 'COMMENT_BODY', 'EOF'],
            },
            {
                // missed VAR_END without spaces in the end
                text: '{{ 12',
                expectedTokenTypes: ['VAR_START', 'NUMBER', 'EOF'],
            },
            {
                // missed VAR_END with spaces in the end
                text: '{{ 12 ',
                expectedTokenTypes: ['VAR_START', 'NUMBER', 'EOF'],
            },
            {
                text: '{% block',
                expectedTokenTypes: ['BLOCK_START', 'NAME', 'EOF'],
            },
            {
                // unexpected character
                text: '{{ var ` var }}',
                expectedTokenTypes: ['VAR_START', 'NAME', 'NAME', 'VAR_END', 'EOF'],
            },

            // multiline {{}}, {%%} and strings are not supported
            {
                text: '{{\nvar',
                expectedTokenTypes: ['VAR_START', 'TEXT', 'EOF'],
            },
            {
                text: '{{ \nvar',
                expectedTokenTypes: ['VAR_START', 'TEXT', 'EOF'],
            },
            {
                text: '{{var\nvar',
                expectedTokenTypes: ['VAR_START', 'NAME', 'TEXT', 'EOF'],
            },
            {
                text: '{{var \nvar',
                expectedTokenTypes: ['VAR_START', 'NAME', 'TEXT', 'EOF'],
            },
            {
                text: '{%\nvar',
                expectedTokenTypes: ['BLOCK_START', 'TEXT', 'EOF'],
            },
            {
                text: '{% \nvar',
                expectedTokenTypes: ['BLOCK_START', 'TEXT', 'EOF'],
            },
            {
                text: '{%var\nvar',
                expectedTokenTypes: ['BLOCK_START', 'NAME', 'TEXT', 'EOF'],
            },
            {
                text: '{%var \nvar',
                expectedTokenTypes: ['BLOCK_START', 'NAME', 'TEXT', 'EOF'],
            },
            {
                text: '{{ "str\nstr',
                expectedTokenTypes: ['VAR_START', 'STRING', 'TEXT', 'EOF'],
                fullTokens: {
                    1: { type: TokenType.STRING, offset: 3, length: 4 },
                    2: { type: TokenType.TEXT, offset: 7, length: 4 },
                },
            },
            {
                text: '{{ var\n{{ var',
                expectedTokenTypes: ['VAR_START', 'NAME', 'TEXT', 'VAR_START', 'NAME', 'EOF'],
            },
        ];

        fixtures.push(...otherFixtures);

        for (let row of fixtures) {
            let actual = tokenize(row.text);
            let actualTokenTypes = actual.map(row => typeToString(row.type));

            assert.deepEqual(actualTokenTypes, row.expectedTokenTypes);

            if (row.fullTokens) {
                for (let index in row.fullTokens) {
                    let actualToken = actual[index];
                    assert.deepEqual(actualToken, row.fullTokens[index]);
                }
            }
        }
    });
});
