import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position, Definition, Range } from 'vscode-languageserver';

describe('dql tests for entity in subfolder', function () {
    let documentUri = projectUri + '/src/Controller/DQL5Controller.php';

    it('definition should work', async function () {
        let service = await getService();

        let fixtures: { from: [number, number], to: [number, number] }[] = [
            { from: [13, 32], to: [8, 0] },
            { from: [13, 61], to: [8, 0] },
            { from: [13, 75], to: [20, 4] },
            { from: [13, 80], to: [20, 4] },
        ];

        for (let { from, to } of fixtures) {
            let actual = await service.onDefinition({
                textDocument: { uri: documentUri },
                position: Position.create(from[0], from[1]),
            });

            let expected: Definition = {
                uri: projectUri + '/src/Entity/Submodule/Product5.php',
                range: Range.create(to[0], to[1], to[0], to[1]),
            };

            assert.deepEqual(actual, expected);
        }
    });

    it('completion should work', async function () {
        let service = await getService();

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(13, 76),
        });

        let actualPriceCompletion = actual.items.filter(row => row.label === 'price')[0];
        let reducedActualPriceCompletion = {
            label: actualPriceCompletion.label,
            textEdit: actualPriceCompletion.textEdit,
        };

        let reducedExpectedPriceCompletion = {
            label: 'price',
            textEdit: {
                range: Range.create(13, 75, 13, 76),
                newText: 'price',
            },
        };

        assert.deepEqual(reducedActualPriceCompletion, reducedExpectedPriceCompletion);
    });
});
