import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position } from 'vscode-languageserver';

describe('complete render parameter in template', function () {
    it('should work', async function () {
        let service = await getService();

        let documentUri = projectUri + '/templates/fixture-21.html.twig';

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(3, 3),
        });

        let item = actual.items.filter(row => row.label === 'countedParamA')[0];
        assert.equal(item.detail, '3 calls');

        let item2 = actual.items.filter(row => row.label === 'countedParamB')[0];
        assert.equal(item2.detail, '1 call');
    });
});
