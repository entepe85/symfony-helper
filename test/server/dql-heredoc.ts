import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position, Definition, Range, Hover, MarkupKind } from 'vscode-languageserver';

describe('dql tests for heredoc strings', function () {
    let documentUri = projectUri + '/src/Controller/DQL6Controller.php';

    it('definition should work', async function () {
        let service = await getService();

        let fixtures: { from: [number, number], to: [number, number] }[] = [
            { from: [15, 17], to: [9, 0] },
            { from: [15, 36], to: [9, 0] },
            { from: [16, 20], to: [21, 4] },
            { from: [16, 25], to: [21, 4] },
        ];

        for (let { from, to } of fixtures) {
            let actual = await service.onDefinition({
                textDocument: { uri: documentUri },
                position: Position.create(from[0], from[1]),
            });

            let expected: Definition = {
                uri: projectUri + '/src/Entity/Product6.php',
                range: Range.create(to[0], to[1], to[0], to[1]),
            };

            assert.deepEqual(actual, expected);
        }
    });

    it('completion should work', async function () {
        let service = await getService();

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(16, 23),
        });

        let actualPriceCompletion = actual.items.filter(row => row.label === 'price')[0];
        let reducedActualPriceCompletion = {
            label: actualPriceCompletion.label,
            textEdit: actualPriceCompletion.textEdit,
        };

        let reducedExpectedPriceCompletion = {
            label: 'price',
            textEdit: {
                range: Range.create(16, 20, 16, 23),
                newText: 'price',
            },
        };

        assert.deepEqual(reducedActualPriceCompletion, reducedExpectedPriceCompletion);
    });

    it('hover should work', async function () {
        let service = await getService();

        let actualLeftEdge = await service.onHover({ textDocument: { uri: documentUri }, position: Position.create(16, 20) });
        let actualRightEdge = await service.onHover({ textDocument: { uri: documentUri }, position: Position.create(16, 25) });

        let expected: Hover = {
            range: Range.create(16, 20, 16, 25),
            contents: {
                kind: MarkupKind.Markdown,
                value: ['```', '@ORM\\Column(type="integer")', '```'].join('\n'),
            }
        };

        assert.deepEqual(actualLeftEdge, expected);
        assert.deepEqual(actualRightEdge, expected);
    });
});
