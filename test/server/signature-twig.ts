import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position, SignatureHelp } from 'vscode-languageserver';

describe('signature help in twig', function () {
    let documentUri = projectUri + '/templates/fixture-42.html.twig';

    it('should support functions', async function () {
        let service = await getService();

        let actual = await service.onSignatureHelp({
            textDocument: { uri: documentUri },
            position: Position.create(5, 25),
        });

        let expected: SignatureHelp = {
            activeParameter: 1,
            activeSignature: 0,
            signatures: [
                {
                    label: 'oneForAll(param, param2)',
                    parameters: [
                        { label: [10, 15], },
                        { label: [17, 23], },
                    ],
                }
            ],
        };

        assert.deepEqual(actual, expected);
    });

    it('should support tests', async function () {
        let service = await getService();

        let actual = await service.onSignatureHelp({
            textDocument: { uri: documentUri },
            position: Position.create(4, 27),
        });

        let expected: SignatureHelp = {
            activeParameter: 0,
            activeSignature: 0,
            signatures: [
                {
                    label: 'oneForAll(param3)',
                    parameters: [
                        { label: [10, 16], },
                    ],
                }
            ],
        };

        assert.deepEqual(actual, expected);
    });

    it('should support calls inside calls and not be fooled by other parentheses', async function () {
        let service = await getService();

        let actual = await service.onSignatureHelp({
            textDocument: { uri: documentUri },
            position: Position.create(10, 61),
        });

        let expected: SignatureHelp = {
            activeParameter: 1,
            activeSignature: 0,
            signatures: [
                {
                    label: 'testB(param, param2)',
                    parameters: [
                        { label: [6, 11], },
                        { label: [13, 19], },
                    ],
                }
            ],
        };

        assert.deepEqual(actual, expected);
    });

    it('should support standalone macro calls', async function () {
        let service = await getService();

        let actual = await service.onSignatureHelp({
            textDocument: { uri: projectUri + '/templates/fixture-43.html.twig' },
            position: Position.create(7, 25),
        });

        let expected: SignatureHelp = {
            activeParameter: 1,
            activeSignature: 0,
            signatures: [
                {
                    label: 'blockD(paramA, paramB, paramC)',
                    parameters: [
                        { label: [7, 13], },
                        { label: [15, 21], },
                        { label: [23, 29], },
                    ],
                }
            ],
        };

        assert.deepEqual(actual, expected);
    });

    it('should support macro calls from macro collections', async function () {
        let service = await getService();

        let actual = await service.onSignatureHelp({
            textDocument: { uri: projectUri + '/templates/fixture-43.html.twig' },
            position: Position.create(8, 16),
        });

        let expected: SignatureHelp = {
            activeParameter: 2,
            activeSignature: 0,
            signatures: [
                {
                    label: 'blockD(paramA, paramB, paramC)',
                    parameters: [
                        { label: [7, 13], },
                        { label: [15, 21], },
                        { label: [23, 29], },
                    ],
                }
            ],
        };

        assert.deepEqual(actual, expected);
    });

    it('should support object methods', async function () {
        let service = await getService();

        let actual = await service.onSignatureHelp({
            textDocument: { uri: projectUri + '/templates/fixture-47.html.twig' },
            position: Position.create(6, 28),
        });

        let expected: SignatureHelp = {
            activeParameter: 1,
            activeSignature: 0,
            signatures: [
                {
                    label: 'methodA(param, param2)',
                    parameters: [
                        { label: [8, 13], },
                        { label: [15, 21], },
                    ],
                }
            ],
        };

        assert.deepEqual(actual, expected);
    });

    it('should support object methods (test 2, for get*() methods)', async function () {
        let service = await getService();

        let actual = await service.onSignatureHelp({
            textDocument: { uri: projectUri + '/templates/fixture-47.html.twig' },
            position: Position.create(7, 28),
        });

        let expected: SignatureHelp = {
            activeParameter: 1,
            activeSignature: 0,
            signatures: [
                {
                    label: 'getSomeData(paramA, paramB)',
                    parameters: [
                        { label: [12, 18], },
                        { label: [20, 26], },
                    ],
                }
            ],
        };

        assert.deepEqual(actual, expected);
    });
});
