import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position, Hover, Range, MarkupKind } from 'vscode-languageserver';

describe('basic tests for hover in dql', function () {
    let documentUri = projectUri + '/src/Controller/DQL2Controller.php';

    it('should work for entity fields', async function () {
        let service = await getService();

        {
            // hover of 'id'
            let actualLeftEdge = await service.onHover({ textDocument: { uri: documentUri }, position: Position.create(13, 27) });
            let actualRightEdge = await service.onHover({ textDocument: { uri: documentUri }, position: Position.create(13, 29) });

            let expected: Hover = {
                range: Range.create(13, 27, 13, 29),
                contents: {
                    kind: MarkupKind.Markdown,
                    value: ['```', '@ORM\\Id()', '@ORM\\GeneratedValue()', '@ORM\\Column(type=\"integer\")', '```'].join('\n'),
                }
            };

            assert.deepEqual(actualLeftEdge, expected);
            assert.deepEqual(actualRightEdge, expected);
        }

        {
            // hover of 'price'
            let actualLeftEdge = await service.onHover({ textDocument: { uri: documentUri }, position: Position.create(13, 65) });
            let actualRightEdge = await service.onHover({ textDocument: { uri: documentUri }, position: Position.create(13, 70) });

            let expected: Hover = {
                range: Range.create(13, 65, 13, 70),
                contents: {
                    kind: MarkupKind.Markdown,
                    value: ['```', 'Price of product.', '@ORM\\Column ( type = "integer")', '```'].join('\n'),
                }
            };

            assert.deepEqual(actualLeftEdge, expected);
            assert.deepEqual(actualRightEdge, expected);
        }
    });

    it('should work for entity classes', async function () {
        let service = await getService();

        let actualLeftEdge = await service.onHover({ textDocument: { uri: documentUri }, position: Position.create(13, 35) });
        let actualRightEdge = await service.onHover({ textDocument: { uri: documentUri }, position: Position.create(13, 54) });

        let expected: Hover = {
            range: Range.create(13, 35, 13, 54),
            contents: {
                kind: MarkupKind.Markdown,
                value: ['```', 'Our products.', '@ORM\\Entity', '@ORM\\Table(name="products2")', '```'].join('\n'),
            }
        };

        assert.deepEqual(actualLeftEdge, expected);
        assert.deepEqual(actualRightEdge, expected);
    });
});
