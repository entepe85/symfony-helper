import { parse } from '../../src/nikic-php-parser';

import * as assert from 'assert';

/* tslint:disable object-literal-key-quotes quotemark */

describe('nikic php parser', function () {
    it('should work', async function () {
        let code = '<?php 42;';
        let ast = await parse(code);

        let expectedAst = [
            {
                "nodeType": "Stmt_Expression",
                "expr": {
                    "nodeType": "Scalar_LNumber",
                    "value": 42,
                    "attributes": {
                        "startFilePos": 6,
                        "endFilePos": 7,
                        "kind": 10
                    }
                },
                "attributes": {
                    "startFilePos": 6,
                    "endFilePos": 8
                }
            }
        ];

        assert.deepEqual(ast, expectedAst);
    });

    it('should work for non ascii symbols', async function () {
        let code = '<?php \'한국어\'; "Россия"; 42;';
        let ast = await parse(code);

        let expectedAst = [
            {
                "nodeType": "Stmt_Expression",
                "expr": {
                    "nodeType": "Scalar_String",
                    "value": "한국어",
                    "attributes": {
                        "startFilePos": 6,
                        "endFilePos": 16,
                        "kind": 1
                    }
                },
                "attributes": {
                    "startFilePos": 6,
                    "endFilePos": 17
                }
            },
            {
                "nodeType": "Stmt_Expression",
                "expr": {
                    "nodeType": "Scalar_String",
                    "value": "Россия",
                    "attributes": {
                        "startFilePos": 19,
                        "endFilePos": 32,
                        "kind": 2
                    }
                },
                "attributes": {
                    "startFilePos": 19,
                    "endFilePos": 33
                }
            },
            {
                "nodeType": "Stmt_Expression",
                "expr": {
                    "nodeType": "Scalar_LNumber",
                    "value": 42,
                    "attributes": {
                        "startFilePos": 35,
                        "endFilePos": 36,
                        "kind": 10
                    }
                },
                "attributes": {
                    "startFilePos": 35,
                    "endFilePos": 37
                }
            }
        ];

        assert.deepEqual(ast, expectedAst);
    });

    it('should collect comments', async function () {
        let code = '<?php\n/** xxx */\nfunction f() {}';
        let ast = await parse(code);

        let expectedAst = [
            {
                "nodeType": "Stmt_Function",
                "byRef": false,
                "name": {
                    "nodeType": "Identifier",
                    "name": "f",
                    "attributes": {
                        "startFilePos": 26,
                        "endFilePos": 26
                    }
                },
                "params": [],
                "returnType": null,
                "stmts": [],
                "attributes": {
                    "startFilePos": 17,
                    "endFilePos": 31,
                    "comments": [
                        {
                            "nodeType": "Comment_Doc",
                            "text": "\/** xxx *\/",
                            "line": 2,
                            "filePos": 6,
                            "tokenPos": 1
                        }
                    ]
                }
            }
        ];

        assert.deepEqual(ast, expectedAst);
    });
});
