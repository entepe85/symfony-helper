import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position } from 'vscode-languageserver';

describe('hover render parameter in template', function () {
    it('should work', async function () {
        let service = await getService();

        let documentUri = projectUri + '/templates/fixture-21.html.twig';

        let actual: any = await service.onHover({
            textDocument: { uri: documentUri },
            position: Position.create(4, 16),
        });

        let markup: string = actual.contents.value;

        assert.ok(markup.includes('render parameter'));
        assert.ok(markup.includes('App\\Controller\\P2Controller#pageA'));
        assert.ok(markup.includes('App\\Controller\\P2Controller#pageB'));
    });
});
