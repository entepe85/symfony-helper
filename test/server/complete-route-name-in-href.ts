import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position, Range, InsertTextFormat } from 'vscode-languageserver';

describe('complete route name in href', function () {
    let documentUri = projectUri + '/templates/fixture-22.html.twig';

    it('should work', async function () {
        let service = await getService();

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(3, 11),
        });

        {
            // route without params

            let actualItem = actual.items.filter(row => row.label === 'b-simple')[0];

            assert.deepEqual(actualItem.textEdit, {
                newText: "{{ path('b-simple') }}",
                range: Range.create(3, 9, 3, 11),
            });
        }

        {
            // route without params

            let actualItem = actual.items.filter(row => row.label === 'b-complex')[0];

            assert.equal(actualItem.insertTextFormat, InsertTextFormat.Snippet);

            assert.deepEqual(actualItem.textEdit, {
                newText: "{{ path('b-complex', { 'year': $1, 'month': $2 }) }}",
                range: Range.create(3, 9, 3, 11),
            });
        }
    });

    it('should not work in twig pieces', async function () {
        let service = await getService();

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(4, 15),
        });

        let actualLabels = actual.items.map(row => row.label);

        assert.ok(actualLabels.indexOf('b-simple') < 0);
        assert.ok(actualLabels.indexOf('b-complex') < 0);
    });
});
