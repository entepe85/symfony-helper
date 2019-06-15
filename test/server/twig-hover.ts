import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position, Hover, Range, MarkupKind } from 'vscode-languageserver';

describe('hover in dql', function () {
    let documentUri = projectUri + '/templates/fixture-24.html.twig';

    it('should work for functions', async function () {
        let service = await getService();

        let actual = await service.onHover({
            textDocument: { uri: documentUri },
            position: Position.create(5, 7),
        });

        let expected: Hover = {
            range: Range.create(5, 7, 5, 16),
            contents: {
                kind: MarkupKind.Markdown,
                value: ['```', 'function oneForAll(param, param2)', 'Function for something', '```'].join('\n'),
            }
        };

        assert.deepEqual(actual, expected);
    });

    it('should work for tests', async function () {
        let service = await getService();

        let actual = await service.onHover({
            textDocument: { uri: documentUri },
            position: Position.create(4, 17),
        });

        let expected: Hover = {
            range: Range.create(4, 17, 4, 26),
            contents: {
                kind: MarkupKind.Markdown,
                value: ['```', '... is oneForAll(param3)', 'Test for something', '```'].join('\n'),
            }
        };

        assert.deepEqual(actual, expected);
    });

    it('should work for filters', async function () {
        let service = await getService();

        let actual = await service.onHover({
            textDocument: { uri: documentUri },
            position: Position.create(7, 17),
        });

        let expected: Hover = {
            range: Range.create(7, 17, 7, 26),
            contents: {
                kind: MarkupKind.Markdown,
                value: ['```', '... | oneForAll', 'Filter for something', '```'].join('\n'),
            }
        };

        assert.deepEqual(actual, expected);
    });
});
