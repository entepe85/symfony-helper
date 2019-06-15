import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position, Range, MarkupKind } from 'vscode-languageserver';

describe('hover route name in template', function () {
    it('should work', async function () {
        let service = await getService();

        let documentUri = projectUri + '/templates/fixture-26.html.twig';

        {
            let actual: any = await service.onHover({
                textDocument: { uri: documentUri },
                position: Position.create(3, 17),
            });

            assert.deepEqual(actual.range, Range.create(3, 17, 3, 35));
            assert.equal(actual.contents.kind, MarkupKind.Markdown);
            assert.ok(actual.contents.value.indexOf('/l/1') >= 0);
            assert.ok(actual.contents.value.indexOf('App\\Controller\\LController::page1') >= 0);
        }

        {
            let actual: any = await service.onHover({
                textDocument: { uri: documentUri },
                position: Position.create(4, 34),
            });

            assert.deepEqual(actual.range, Range.create(4, 16, 4, 35));
            assert.equal(actual.contents.kind, MarkupKind.Markdown);
            assert.ok(actual.contents.value.indexOf('/l/2') >= 0);
            assert.ok(actual.contents.value.indexOf('App\\Controller\\LController::page2') >= 0);
        }
    });
});
