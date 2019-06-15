import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position } from 'vscode-languageserver';

describe('raw sql queries', function () {
    it(`should support completion in template for 'fetchAll()'`, async function () {
        let service = await getService();

        let documentUri = projectUri + '/templates/fixture-41.html.twig';

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(4, 8),
        });

        let actualLabels = actual.items.map(row => row.label);

        let expectedLabels = ['id', 'name', 'count'];
        let unexpectedLabels = ['ID', 'population', 'now', 'xxxx', 'select', 'as'];

        for (let label of expectedLabels) {
            assert.ok(actualLabels.indexOf(label) >= 0);
        }
        for (let label of unexpectedLabels) {
            assert.ok(actualLabels.indexOf(label) < 0);
        }
    });

    it(`should support completion in template for 'fetchAssoc()'`, async function () {
        let service = await getService();

        let documentUri = projectUri + '/templates/fixture-41.html.twig';

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(5, 9),
        });

        let actualLabels = actual.items.map(row => row.label);

        let expectedLabels = ['id', 'name'];

        for (let label of expectedLabels) {
            assert.ok(actualLabels.indexOf(label) >= 0);
        }
    });
});
