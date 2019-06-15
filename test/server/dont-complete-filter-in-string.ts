import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position } from 'vscode-languageserver';

describe('filter completion', function () {
    it('should not work inside of strings', async function () {
        let service = await getService();
        let documentUri = projectUri + '/templates/fixture-25.html.twig';

        let testedFilter = 'filterA';

        {
            // test that filter exist in fixtures
            let actual = await service.onCompletition({
                textDocument: { uri: documentUri },
                position: Position.create(3, 9),
            });
            let actualLabels = actual.items.map(row => row.label);
            assert.ok(actualLabels.indexOf(testedFilter) >= 0);
        }

        {
            // main test
            let actual = await service.onCompletition({
                textDocument: { uri: documentUri },
                position: Position.create(4, 6),
            });
            let actualLabels = actual.items.map(row => row.label);
            assert.ok(actualLabels.indexOf(testedFilter) < 0);
        }
    });
});
