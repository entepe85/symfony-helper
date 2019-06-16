import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position, Definition, Range } from 'vscode-languageserver';

describe('entity in template', function () {
    let documentUri = projectUri + '/templates/books/10.html.twig';

    it('should support hover over field', async function () {
        let service = await getService();

        let actual: any = await service.onHover({
            textDocument: { uri: documentUri },
            position: Position.create(3, 16) ,
        });

        assert.ok(actual.contents.value.indexOf('Summary of author name') >= 0);
    });

    it('should support definition of field', async function () {
        let service = await getService();

        let actual = await service.onDefinition({
            textDocument: { uri: documentUri },
            position: Position.create(3, 16) ,
        });

        let expected: Definition = {
            uri: projectUri + '/src/Entity/Author.php',
            range: Range.create(29, 4, 29, 4),
        };

        assert.deepEqual(actual, expected);
    });
});
