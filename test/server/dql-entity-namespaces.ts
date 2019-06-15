import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position, Definition, Range } from 'vscode-languageserver';

describe('dql entity namespaces', function () {
    let documentUri = projectUri + '/src/Controller/DQL13Controller.php';

    it('should support definition', async function () {
        let service = await getService();

        let fixtures = [
            { from: [14, 32], to: [8, 0] },
            { from: [14, 44], to: [8, 0] },
            { from: [14, 55], to: [21, 12] },
        ];

        for (let i = 0; i < fixtures.length; i++) {
            let { from, to } = fixtures[i];

            let actual = await service.onDefinition({
                textDocument: { uri: documentUri },
                position: Position.create(from[0], from[1]),
            })

            let expected: Definition = {
                uri: projectUri + '/src/Entity/Product1.php',
                range: Range.create(to[0], to[1], to[0], to[1]),
            }

            assert.deepEqual(actual, expected, `fixture ${i} failed`);
        }
    });

    it('should support completion', async function () {
        let service = await getService();

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(14, 55),
        });

        let actualLabels = actual.items.map(row => row.label);

        let expectedLabels = ['id', 'price'];

        for (let label of expectedLabels) {
            assert.ok(actualLabels.indexOf(label) >= 0);
        }
    });
});
