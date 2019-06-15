import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position, Definition, Range } from 'vscode-languageserver';

describe(`dql tests for entity not in 'src/Entity/'`, function () {
    let documentUri = projectUri + '/src/Controller/DQL14Controller.php';

    it('definition should work', async function () {
        let service = await getService();

        let fixtures: { from: [number, number], to: [string, number, number] }[] = [
            { from: [14, 46], to: ['/src/Entity2/D1.php', 11, 0] },
            { from: [14, 67], to: ['/src/Entity/Embed1.php', 18, 4] },
            { from: [15, 40], to: ['/src/Entity2/D1.php', 11, 0] },
            { from: [15, 53], to: ['/src/Entity2/D1.php', 18, 4] },
        ];

        for (let i = 0; i < fixtures.length; i++) {
            let { from, to } = fixtures[i];

            let actual = await service.onDefinition({
                textDocument: { uri: documentUri },
                position: Position.create(from[0], from[1]),
            });

            let expected: Definition = {
                uri: projectUri + to[0],
                range: Range.create(to[1], to[2], to[1], to[2]),
            };

            assert.deepEqual(actual, expected, `fixture ${i} failed`);
        }
    });
});
