import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position, Location, Range, Hover, MarkupContent, CompletionItemKind } from 'vscode-languageserver';
import { promisify } from 'util';
import { readFile } from 'fs';
import URI from 'vscode-uri';
import { fileExists } from '../../src/utils';

describe(`function 'constant()' in templates`, function () {
    let documentUri = projectUri + '/templates/fixture-29.html.twig';
    let constantsFileUri = projectUri + '/src/Logic/Constants.php';

    it(`should support 'go to definition'`, async function () {

        let service = await getService();

        {
            let fixtures = [
                { from: [3, 13], to: [9, 0] },
                { from: [3, 34], to: [9, 0] },
                { from: [3, 36], to: [15, 4] },
                { from: [3, 50], to: [15, 4] },
            ];

            for (let { from, to } of fixtures) {
                let actual = await service.onDefinition({
                    textDocument: { uri: documentUri },
                    position: Position.create(from[0], from[1]),
                });

                let expected: Location = {
                    uri: constantsFileUri,
                    range: Range.create(to[0], to[1], to[0], to[1]),
                };

                assert.deepEqual(actual, expected);
            }
        }

        {
            let missFixtures = [
                [3, 12],
                [3, 35],
                [3, 51],
            ];

            for (let [line, character] of missFixtures) {
                let actual = await service.onDefinition({
                    textDocument: { uri: documentUri },
                    position: Position.create(line, character),
                });

                assert.ok(actual === null);
            }
        }
    });

    it(`should be more permissive in 'go to definition'`, async function () {
        let service = await getService();

        let fixtures = [
            { from: [4, 13], to: [9, 0] },
            { from: [4, 36], to: [9, 0] },
        ];

        for (let { from, to } of fixtures) {
            let actual = await service.onDefinition({
                textDocument: { uri: documentUri },
                position: Position.create(from[0], from[1]),
            });

            let expected: Location = {
                uri: constantsFileUri,
                range: Range.create(to[0], to[1], to[0], to[1]),
            };

            assert.deepEqual(actual, expected);
        }
    });

    it('should support completion of constants (after the second colon)', async function () {
        let service = await getService();

        let fixtures = [
            [3, 36],
            [3, 38],
            [3, 43], // don't forget '_',
            [5, 38], // class with leading '\'
        ];

        let expectedLabels = ['FIRST_CONSTANT', 'SECOND_CONSTANT'];

        let privateConstant = 'THIRD_CONSTANT';
        let unexpectedLabels = ['app', 'globalA', 'functionA', privateConstant];

        let constantsFilePath = URI.parse(constantsFileUri).fsPath;
        let constantsFileCode = await promisify(readFile)(constantsFilePath);
        assert.ok(constantsFileCode.includes(`private const ${privateConstant} = `)); // test of existence of 'THIRD_CONSTANT'

        for (let [line, character] of fixtures) {
            let actual = await service.onCompletition({
                textDocument: { uri: documentUri },
                position: Position.create(line, character),
            });

            let actualLabels = actual.items.map(row => row.label);

            for (let label of expectedLabels) {
                assert.ok(actualLabels.indexOf(label) >= 0);
            }

            for (let label of unexpectedLabels) {
                assert.ok(actualLabels.indexOf(label) < 0);
            }
        }
    });

    it('should support completion of constants for interfaces', async function () {
        let service = await getService();

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(10, 37),
        });

        let actualLabels = actual.items.map(row => row.label);

        let expectedLabels = ['CONST_A', 'CONST_B'];

        for (let label of expectedLabels) {
            assert.ok(actualLabels.indexOf(label) >= 0);
        }
    });

    it('constants in completion should have certain structure', async function () {
        let service = await getService();

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(3, 38),
        });

        let firstConstant = actual.items.filter(row => row.label === 'FIRST_CONSTANT')[0];

        assert.deepEqual(firstConstant.documentation, 'First constant.');
    });

    it('should support hover over class', async function () {
        let service = await getService();

        let fixtures = [
            { point: [3, 13], resultRange: [3, 13, 3, 34] },
            { point: [3, 34], resultRange: [3, 13, 3, 34] },
            { point: [4, 13], resultRange: [4, 13, 4, 36] },
            { point: [4, 36], resultRange: [4, 13, 4, 36] },
        ];

        for (let { point, resultRange } of fixtures) {
            let actual = await service.onHover({
                textDocument: { uri: documentUri },
                position: Position.create(point[0], point[1]),
            }) as Hover;

            assert.deepEqual(actual.range, Range.create(resultRange[0], resultRange[1], resultRange[2], resultRange[3]));
            assert.ok((actual.contents as MarkupContent).value.includes('Some constants for business-logic.'));
        }
    });

    it('should support hover over class constant', async function () {
        let service = await getService();

        let fixtures = [
            [3, 36],
            [3, 50],
        ];

        for (let [line, character] of fixtures) {
            let actual = await service.onHover({
                textDocument: { uri: documentUri },
                position: Position.create(line, character),
            }) as Hover;

            assert.deepEqual(actual.range, Range.create(3, 36, 3, 50));

            let actualValue = (actual.contents as MarkupContent).value;
            assert.ok(actualValue.includes('First constant.'));
            assert.ok(actualValue.includes('const FIRST_CONSTANT = 11111;'));
        }
    });

    it('should support completion of classes if string does not contain \\', async function () {
        let service = await getService();

        let expectedLabels = [
            'Constants', // src/Logic/Constants.php
        ];

        let fixtures = [
            [8, 13],
            [8, 15],
        ];

        for (let [line, character] of fixtures) {
            let actual = await service.onCompletition({
                textDocument: { uri: documentUri },
                position: Position.create(line, character),
            });

            let actualLabels = actual.items.map(row => row.label);
            for (let label of expectedLabels) {
                assert.ok(actualLabels.indexOf(label) >= 0);
            }
        }
    });

    it('should distinguish between classes and interfaces in completion', async function () {
        let service = await getService();

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(9, 16),
        });

        let classItem = actual.items.filter(row => row.label === 'Constants')[0];
        let interfaceItem = actual.items.filter(row => row.label === 'Constants2')[0];

        assert.equal(classItem.kind, CompletionItemKind.Class);
        assert.equal(interfaceItem.kind, CompletionItemKind.Interface);
    });

    it('should ignore classes without constants in completion of classes', async function () {
        let service = await getService();

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(11, 13),
        });

        let actualLabels = actual.items.map(row => row.label);

        let expectedFiles = [projectUri + '/src/Logic/ClassWithoutConstants.php', projectUri + '/vendor/symfony/http-foundation/RequestStack.php'];
        let unexpectedLabels = ['ClassWithoutConstants', 'RequestStack'];

        for (let fileUri of expectedFiles) {
            let filePath = URI.parse(fileUri).fsPath;
            assert.ok(await fileExists(filePath));
        }

        for (let label of unexpectedLabels) {
            assert.ok(actualLabels.indexOf(label) < 0);
        }
    });
});
