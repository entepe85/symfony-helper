import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position, CompletionItemKind, Range, CompletionItem } from 'vscode-languageserver';

describe('basic tests for completion in dql', function () {
    let documentUri = projectUri + '/src/Controller/DQL3Controller.php';

    it('should work for entity fields', async function () {
        let service = await getService();

        let testedPositions = [
            [13, 27],
            [13, 63],
            [13, 65],
        ];

        let expectedLabels = ['id', 'name', 'price'];
        let unexpectedLabels = ['cache', 'getName', 'setPrice'];

        for (let pos of testedPositions) {
            let actual = await service.onCompletition({
                textDocument: { uri: documentUri },
                position: Position.create(pos[0], pos[1]),
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

    it('completion for field should have special structure', async function () {
        let service = await getService();

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(13, 65),
        });

        let actualPriceCompletion = actual.items.filter(row => row.label === 'price')[0];

        let expectedPriceCompletion: CompletionItem = {
            label: 'price',
            kind: CompletionItemKind.Property,
            textEdit: {
                range: Range.create(13, 63, 13, 65),
                newText: 'price',
            },
            detail: 'integer',
            documentation: {
                kind: 'markdown',
                value: ['```', 'Price of product.', '@ORM\\Column(type="integer")', '```'].join('\n')
            },
        };

        assert.deepEqual(actualPriceCompletion, expectedPriceCompletion);
    });

    it('completion should recognize relative and absolute "targetEntity" references', async function () {
        let service = await getService();

        let documentUri = projectUri + '/src/Controller/DQL9Controller.php';

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(13, 29),
        });

        let testedFields = ['owner', 'where', 'where2'];

        for (let field of testedFields) {
            let item = actual.items.filter(row => row.label === field)[0];

            assert.equal(item.detail, 'App\\Entity\\Joins\\Person');
        }
    });

    it('should recognize @ManyToMany, @OneToMany and @OneToOne', async function () {
        let service = await getService();

        let documentUri = projectUri + '/src/Controller/DQL10Controller.php';

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(13, 69),
        });

        let actualLabels = actual.items.map(row => row.label);

        let expectedLabels = ['linkedB', 'linkedC', 'linkedD'];

        for (let label of expectedLabels) {
            assert.ok(actualLabels.indexOf(label) >= 0);
        }
    });
});
