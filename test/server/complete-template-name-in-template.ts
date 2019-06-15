import * as assert from 'assert';
import { Position, CompletionItemKind, Range, CompletionItem } from 'vscode-languageserver';
import { projectUri, getService } from './_utils';

describe('autocomplete template name in template', function () {
    it('should work', async function () {
        let service = await getService();

        let documentUri = projectUri + '/templates/fixture-8.html.twig';

        let fixtures = [
            { position: [0, 12] },
            { position: [3, 12] },
        ];

        let someOfExpectedLabels = ['base.html.twig', 'pieces/_part.html.twig'];

        for (let { position } of fixtures) {
            let actual = await service.onCompletition({
                textDocument: { uri: documentUri },
                position: Position.create(position[0], position[1]),
            });

            let actualLabels = actual.items.map(item => item.label);

            for (let label of someOfExpectedLabels) {
                assert.ok(actualLabels.indexOf(label) >= 0);
            }
        }
    });

    it('should work good after \'.\' symbol', async function () {
        let service = await getService();

        let documentUri = projectUri + '/templates/fixture-8.html.twig';

        {
            let actual = await service.onCompletition({
                textDocument: { uri: documentUri },
                position: Position.create(0, 19),
            });

            let actualItem = actual.items.filter(row => row.label === 'base.html.twig')[0];

            let expectedItem: CompletionItem = {
                label: 'base.html.twig',
                kind: CompletionItemKind.File,
                textEdit: {
                    range: Range.create(0, 12, 0, 19),
                    newText: 'base.html.twig',
                },
            };

            assert.deepEqual(actualItem, expectedItem);
        }

        {
            let actual = await service.onCompletition({
                textDocument: { uri: documentUri },
                position: Position.create(3, 28),
            });

            let actualItem = actual.items.filter(row => row.label === 'pieces/_part.html.twig')[0];

            let expectedItem: CompletionItem = {
                label: 'pieces/_part.html.twig',
                kind: CompletionItemKind.File,
                textEdit: {
                    range: Range.create(3, 12, 3, 28),
                    newText: 'pieces/_part.html.twig',
                },
            };

            assert.deepEqual(actualItem, expectedItem);
        }
    });
});
