import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position, Definition, Range } from 'vscode-languageserver';

describe('object members in twig', function () {
    it('should support definition', async function () {
        let service = await getService();

        let fixtures = [
            { from: [0, 15], to: [14, 4] }, // property
            { from: [1, 10], to: [21, 4] }, // method, not 'get*()'
            { from: [2, 10], to: [29, 4] }, // method of form 'get*()' not returning private variable
            { from: [3, 10], to: [37, 4] }, // method of form 'is*()'
            { from: [4, 10], to: [45, 4] }, // method of form 'has*()'
        ];

        for (let { from, to } of fixtures) {
            let actual = await service.onDefinition({
                textDocument: { uri: projectUri + '/templates/fixture-45.html.twig' },
                position: Position.create(from[0], from[1]),
            });

            let expected: Definition = {
                uri: projectUri + '/src/Logic/Service2.php',
                range: Range.create(to[0], to[1], to[0], to[1]),
            };

            assert.deepEqual(actual, expected);
        }
    });

    it('should support hover', async function () {
        let service = await getService();

        let fixtures = [
            { point: [0, 10], text: 'Summary of $propA' }, // property
            { point: [1, 17], text: `Summary of 'methodA'` }, // method, not 'get*()'
            { point: [2, 10], text: `Summary of 'getSomethingImportant'` }, // method of form 'get*()' not returning private variable
        ];

        for (let { point, text } of fixtures) {
            let actual = await service.onHover({
                textDocument: { uri: projectUri + '/templates/fixture-45.html.twig' },
                position: Position.create(point[0], point[1])
            }) as any;

            assert.ok(actual.contents.value.includes(text));
        }
    });

    it('should support definition for array values', async function () {
        let service = await getService();

        let fixtures = [
            { from: [0, 17], to: [14, 4] }, // property
            { from: [1, 35], to: [29, 4] }, // method of form 'get*()'
            { from: [4, 13], to: [14, 4] }, // after {%set%}
        ];

        for (let i = 0; i < fixtures.length; i++) {
            let { from, to } = fixtures[i];

            let actual = await service.onDefinition({
                textDocument: { uri: projectUri + '/templates/fixture-47.html.twig' },
                position: Position.create(from[0], from[1]),
            });

            let expected: Definition = {
                uri: projectUri + '/src/Logic/Service2.php',
                range: Range.create(to[0], to[1], to[0], to[1]),
            };

            assert.deepEqual(actual, expected, `fixture ${i} failed`);
        }
    });

    it('should support completion for array values', async function () {
        let service = await getService();

        let actual = await service.onCompletition({
            textDocument: { uri: projectUri + '/templates/fixture-47.html.twig' },
            position: Position.create(0, 20),
        });

        let actualLabels = actual.items.map(row => row.label);

        let expectedLabels = ['propA', 'methodA', 'somethingImportant', 'valid', 'data'];

        for (let label of expectedLabels) {
            assert.ok(actualLabels.indexOf(label) >= 0, `could not find label '${label}'`);
        }
    });

    it('should support definition for result of method call', async function () {
        let service = await getService();

        let fixtures = [
            { from: [0, 19], to: [15, 4] },
            { from: [1, 28], to: [15, 4] },
        ];

        for (let i = 0; i < fixtures.length; i++) {
            let { from, to } = fixtures[i];

            let actual = await service.onDefinition({
                textDocument: { uri: projectUri + '/templates/fixture-48.html.twig' },
                position: Position.create(from[0], from[1]),
            });

            let expected: Definition = {
                uri: projectUri + '/src/Logic/Service3.php',
                range: Range.create(to[0], to[1], to[0], to[1]),
            };

            assert.deepEqual(actual, expected, `fixture ${i} failed`);
        }
    });

    it('should support completion for result of method call', async function () {
        let service = await getService();

        let fixtures = [
            { point: [0, 19] },
            { point: [1, 30] },
        ];

        let expectedLabels = ['prop3'];

        for (let i = 0; i < fixtures.length; i++) {
            let { point } = fixtures[i];

            let actual = await service.onCompletition({
                textDocument: { uri: projectUri + '/templates/fixture-48.html.twig' },
                position: Position.create(point[0], point[1]),
            });

            let actualLabels = actual.items.map(row => row.label);

            for (let label of expectedLabels) {
                assert.ok(actualLabels.indexOf(label) >= 0, `could not find label '${label}'`);
            }
        }
    });

    it('should support definition for result of function call', async function () {
        let service = await getService();

        let fixtures = [
            { from: [0, 25], to: [15, 4] },
        ];

        for (let i = 0; i < fixtures.length; i++) {
            let { from, to } = fixtures[i];

            let actual = await service.onDefinition({
                textDocument: { uri: projectUri + '/templates/fixture-49.html.twig' },
                position: Position.create(from[0], from[1]),
            });

            let expected: Definition = {
                uri: projectUri + '/src/Logic/Service3.php',
                range: Range.create(to[0], to[1], to[0], to[1]),
            };

            assert.deepEqual(actual, expected, `fixture ${i} failed`);
        }
    });

    it('should support completion for result of function call', async function () {
        let service = await getService();

        let fixtures = [
            { point: [0, 25] },
        ];

        let expectedLabels = ['prop3'];

        for (let i = 0; i < fixtures.length; i++) {
            let { point } = fixtures[i];

            let actual = await service.onCompletition({
                textDocument: { uri: projectUri + '/templates/fixture-49.html.twig' },
                position: Position.create(point[0], point[1]),
            });

            let actualLabels = actual.items.map(row => row.label);

            for (let label of expectedLabels) {
                assert.ok(actualLabels.indexOf(label) >= 0, `could not find label '${label}'`);
            }
        }
    });
});
