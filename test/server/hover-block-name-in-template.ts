import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position, Hover, Range, MarkupKind } from 'vscode-languageserver';

describe('hover block name in template', function () {
    it('should work', async function () {
        let service = await getService();

        let documentUri = projectUri + '/templates/t1-final.twig';

        let actual = await service.onHover({
            textDocument: { uri: documentUri },
            position: Position.create(5, 9),
        });

        let expected: Hover = {
            range: Range.create(5, 9, 5, 15),
            contents: {
                kind: MarkupKind.Markdown,
                value: ['```', 'defined in t1-b1.twig', 'used in t1-b2.twig', '```'].join('\n'),
            },
        };

        assert.deepEqual(actual, expected);
    });
});
