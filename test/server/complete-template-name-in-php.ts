import * as assert from 'assert';
import { Position } from 'vscode-languageserver';
import { projectUri, getService } from './_utils';

describe('autocomplete template name in php', function () {
    it('should work', async function () {
        let service = await getService();

        let documentUri = projectUri + '/src/Controller/MController.php';

        {
            // right after '('

            let actual = await service.onCompletition({
                textDocument: { uri: documentUri },
                position: Position.create(13, 29),
            });

            let actualLabels = actual.items.map(item => item.label);
            assert.ok(actualLabels.indexOf('fixture-10.html.twig') !== -1);

            let actualNewTexts = actual.items.map((item) => (item.textEdit ? item.textEdit.newText : ''));
            assert.ok(actualNewTexts.indexOf('\'fixture-10.html.twig\'') !== -1);
        }

        {
            // right after '(' in existing name

            let actual = await service.onCompletition({
                textDocument: { uri: documentUri },
                position: Position.create(13, 31),
            });

            let actualLabels = actual.items.map(item => item.label);
            assert.ok(actualLabels.indexOf('fixture-10.html.twig') !== -1);

            let actualNewTexts = actual.items.map((item) => (item.textEdit ? item.textEdit.newText : ''));
            assert.ok(actualNewTexts.indexOf('fixture-10.html.twig') !== -1);
        }

        {
            // on next line

            let actual = await service.onCompletition({
                textDocument: { uri: documentUri },
                position: Position.create(22, 12),
            });

            let actualLabels = actual.items.map(item => item.label);
            assert.ok(actualLabels.indexOf('fixture-10.html.twig') !== -1);

            let actualNewTexts = actual.items.map((item) => (item.textEdit ? item.textEdit.newText : ''));
            assert.ok(actualNewTexts.indexOf('\'fixture-10.html.twig\'') !== -1);
        }
    });
});
