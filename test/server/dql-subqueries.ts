import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position, Definition, Range } from 'vscode-languageserver';

describe('dql subqueries', function () {
    let documentUri = projectUri + '/src/Controller/DQL11Controller.php';

    it('should support definition', async function () {
        let service = await getService();

        let fixtures: { from: [number, number], to: [string, number, number] }[] = [
            // entities
            { from: [14, 59], to: ['E4.php', 9, 0]},
            { from: [14, 72], to: ['E4.php', 9, 0]},
            { from: [16, 71], to: ['E3.php', 13, 0]},

            // fields
            { from: [14, 44], to: ['E4.php', 23, 4]},
            { from: [14, 93], to: ['E4.php', 23, 4]},
            { from: [14, 99], to: ['E2.php', 25, 4]},
            { from: [16, 29], to: ['E2.php', 25, 4]},
            { from: [16, 44], to: ['E3.php', 29, 4]},
        ];

        for (let i = 0; i < fixtures.length; i++) {
            let { from, to } = fixtures[i];

            let actual = await service.onDefinition({
                textDocument: { uri: documentUri },
                position: Position.create(from[0], from[1]),
            })

            let expected: Definition = {
                uri: projectUri + '/src/Entity/' + to[0],
                range: Range.create(to[1], to[2], to[1], to[2]),
            };

            assert.deepEqual(actual, expected, `fixture ${i} failed`);
        }
    });

    it('should support completion', async function () {
        let service = await getService();

        let fixtures = [
            { point: [14, 99], expectedLabels: ['id', 'e2number'] },
            { point: [14, 85], expectedLabels: ['id', 'e4number'] },
        ]

        for (let { point, expectedLabels } of fixtures) {
            let actual = await service.onCompletition({
                textDocument: { uri: documentUri },
                position: Position.create(point[0], point[1]),
            });

            let actualLabels = actual.items.map(row => row.label);

            for (let label of expectedLabels) {
                assert.ok(actualLabels.indexOf(label) >= 0);
            }
        }
    });
});
