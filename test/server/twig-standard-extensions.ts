import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position, Definition, Range } from 'vscode-languageserver';

describe('tests for standard twig extensions', function () {
    let documentUri = projectUri + '/templates/fixture-23.html.twig';

    it('jump should work', async function () {
        let service = await getService();

        let fixtures: { from: [number, number], to: [number, number, string] }[] = [
            { from: [6, 22], to: [191, 12, '/vendor/twig/twig/lib/Twig/Extension/Core.php'] },
            { from: [7, 11], to: [210, 12, '/vendor/twig/twig/lib/Twig/Extension/Core.php'] },
            { from: [9, 6], to: [194, 12, '/vendor/twig/twig/lib/Twig/Extension/Core.php'] },
            { from: [9, 27], to: [139, 12, '/vendor/twig/twig/lib/Twig/Extension/Core.php'] },
        ];

        for (let { from, to } of fixtures) {
            let actual = await service.onDefinition({
                textDocument: { uri: documentUri },
                position: Position.create(from[0], from[1]),
            });

            let expected: Definition = {
                uri: projectUri + to[2],
                range: Range.create(to[0], to[1], to[0], to[1]),
            };

            assert.deepEqual(actual, expected);
        }
    });

    it('completion should work in function position', async function () {
        let service = await getService();

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(6, 24),
        });

        let actualLabels = actual.items.map(row => row.label);

        let expectedLabels = ['constant', 'max', 'range'];

        let unexpectedLabels = [
            'escape', 'join', // filters
            'defined', 'iterable', // tests
        ];

        for (let label of expectedLabels) {
            assert.ok(actualLabels.indexOf(label) >= 0);
        }
        for (let label of unexpectedLabels) {
            assert.ok(actualLabels.indexOf(label) < 0);
        }
    });

    it('completion should work in filter position', async function () {
        let service = await getService();

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(9, 29),
        });

        let actualLabels = actual.items.map(row => row.label);

        let expectedLabels = ['date', 'escape', 'join', 'length'];

        let unexpectedLabels = [
            'constant', 'max', 'range', // functions
            'defined', 'iterable', // tests
        ];

        for (let label of expectedLabels) {
            assert.ok(actualLabels.indexOf(label) >= 0);
        }
        for (let label of unexpectedLabels) {
            assert.ok(actualLabels.indexOf(label) < 0);
        }
    });

    it('completion should work in test position', async function () {
        let service = await getService();

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(7, 14),
        });

        let actualLabels = actual.items.map(row => row.label);

        let expectedLabels = ['defined', 'iterable', 'constant'];

        let unexpectedLabels = [
            'max', 'range', // functions
            'escape', 'length', // filters
        ];

        for (let label of expectedLabels) {
            assert.ok(actualLabels.indexOf(label) >= 0);
        }
        for (let label of unexpectedLabels) {
            assert.ok(actualLabels.indexOf(label) < 0);
        }
    });
});
