import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position, Definition, Range } from 'vscode-languageserver';

describe('basic tests for definitions in dql', function () {
    let documentUri = projectUri + '/src/Controller/DQL1Controller.php';

    it('should work for entity fields', async function () {
        let service = await getService();

        let fixtures: { from: [number, number], to: false | [number, number] }[] = [
            { from: [13, 27], to: [15, 4] },
            { from: [13, 29], to: [15, 4] },
            { from: [13, 30], to: false },
            { from: [13, 68], to: [21, 12] },
            { from: [13, 73], to: [21, 12] },
            { from: [13, 74], to: false },
        ];

        for (let { from, to } of fixtures) {
            let actual = await service.onDefinition({
                textDocument: { uri: documentUri },
                position: Position.create(from[0], from[1]),
            });

            let expected: Definition | null = null;
            if (to) {
                expected = {
                    uri: projectUri + '/src/Entity/Product1.php',
                    range: Range.create(to[0], to[1], to[0], to[1]),
                };
            }

            assert.deepEqual(actual, expected);
        }
    });

    it('should work for entity classes', async function () {
        let service = await getService();

        let fixtures: { from: [number, number], to: false | [number, number] }[] = [
            { from: [13, 34], to: false },
            { from: [13, 35], to: [8, 0] },
            { from: [13, 54], to: [8, 0] },
        ];

        for (let { from, to } of fixtures) {
            let actual = await service.onDefinition({
                textDocument: { uri: documentUri },
                position: Position.create(from[0], from[1]),
            });

            let expected: Definition | null = null;
            if (to) {
                expected = {
                    uri: projectUri + '/src/Entity/Product1.php',
                    range: Range.create(to[0], to[1], to[0], to[1]),
                };
            }

            assert.deepEqual(actual, expected);
        }
    });
});
