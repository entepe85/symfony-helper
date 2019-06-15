import * as assert from 'assert';
import { Position } from 'vscode-languageserver';
import { projectUri, getService } from './_utils';

describe('dont autocomplete after dot in templates', function () {
    it('unless its implemented', async function () {
        let service = await getService();

        let documentUri =  projectUri + '/templates/fixture-20.html.twig';

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(3, 7),
        });

        assert.ok(actual.items.length === 0);
    });
});
