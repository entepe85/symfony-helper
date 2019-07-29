import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position, Definition, Range, Hover, MarkupKind } from 'vscode-languageserver';

describe('dql tests for multiline strings', function () {
    let documentUri = projectUri + '/src/Controller/DQL4Controller.php';

    it('definition should work', async function () {
        let service = await getService();

        let fixtures: { from: [number, number], to: [number, number] }[] = [
            { from: [14, 25], to: [22, 4] },
            { from: [14, 30], to: [22, 4] },
            { from: [15, 17], to: [8, 0] },
            { from: [15, 36], to: [8, 0] },
            { from: [16, 20], to: [27, 4] },
            { from: [16, 24], to: [27, 4] },
        ];

        for (let { from, to } of fixtures) {
            let actual = await service.onDefinition({
                textDocument: { uri: documentUri },
                position: Position.create(from[0], from[1]),
            });

            let expected: Definition = {
                uri: projectUri + '/src/Entity/Product4.php',
                range: Range.create(to[0], to[1], to[0], to[1]),
            };

            assert.deepEqual(actual, expected);
        }
    });

    it('completion should work', async function () {
        let service = await getService();

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(16, 22),
        });

        let actualTypeCompletion = actual.items.filter(row => row.label === 'type')[0];
        let reducedActualTypeCompletion = {
            label: actualTypeCompletion.label,
            textEdit: actualTypeCompletion.textEdit,
        };

        let reducedExpectedTypeCompletion = {
            label: 'type',
            textEdit: {
                range: Range.create(16, 20, 16, 22),
                newText: 'type',
            },
        };

        assert.deepEqual(reducedActualTypeCompletion, reducedExpectedTypeCompletion);
    });

    it('hover should work', async function () {
        let service = await getService();

        let actualLeftEdge = await service.onHover({ textDocument: { uri: documentUri }, position: Position.create(14, 25) });
        let actualRightEdge = await service.onHover({ textDocument: { uri: documentUri }, position: Position.create(14, 30) });

        let expected: Hover = {
            range: Range.create(14, 25, 14, 30),
            contents: {
                kind: MarkupKind.Markdown,
                value: ['```', 'Normal price of product\n', '@ORM\\Column(type="integer")', '```'].join('\n'),
            }
        };

        assert.deepEqual(actualLeftEdge, expected);
        assert.deepEqual(actualRightEdge, expected);
    });
});
