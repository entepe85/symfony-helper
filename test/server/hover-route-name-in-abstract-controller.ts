import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position, Range, MarkupKind } from 'vscode-languageserver';

describe('hover route name in AbstractController', function () {
    it('should work', async function () {
        let service = await getService();

        let documentUri = projectUri + '/src/Controller/K3Controller.php';

        let actual: any = await service.onHover({
            textDocument: { uri: documentUri },
            position: Position.create(13, 30),
        });

        assert.deepEqual(actual.range, Range.create(13, 27, 13, 36));
        assert.equal(actual.contents.kind, MarkupKind.Markdown);
        assert.ok(actual.contents.value.indexOf('/k3') >= 0);
        assert.ok(actual.contents.value.indexOf('App\\Controller\\K3Controller::page') >= 0);
    });
});
