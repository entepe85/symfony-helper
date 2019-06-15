import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position, Range, TextEdit } from 'vscode-languageserver';

describe('complete route in twig', function () {
    let documentUri = projectUri + '/templates/fixture-9.html.twig';
    let expectedRoute = 'test-url-1';

    {
        let fixtures: [number, number, boolean][] = [
            [3, 8, false],
            [3, 9, true],
            [3, 17, true],
            [3, 18, false],
            [4, 7, false],
            [4, 8, true],
            [4, 12, true],
            [4, 13, false],
        ];

        for (let i = 0; i < fixtures.length; i++) {
            it(`should work for path() and url() (test ${i+1})`, async function () {
                let service = await getService();

                let [line, character, hasRoute] = fixtures[i];

                let actual = await service.onCompletition({
                    textDocument: { uri: documentUri },
                    position: Position.create(line, character),
                });

                let route = actual.items.filter(item => item.label === expectedRoute)[0];

                assert.equal(route !== undefined, hasRoute);
            });
        }
    }

    it('should have proper edit range', async function () {
        let service = await getService();

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(3, 17),
        });

        let route = actual.items.filter(item => item.label === expectedRoute)[0];

        let expectedEditRange = Range.create(3, 9, 3, 17);

        assert.deepEqual(route.textEdit!.range, expectedEditRange);
    });

    it('should insert route params if path()/url() has only one parameter', async function () {
        let service = await getService();

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(3, 17),
        });

        let route = actual.items.filter(item => item.label === expectedRoute)[0];

        let expectedAdditionalEdit: TextEdit = {
            newText: ", {'year': '', 'month': ''}",
            range: Range.create(3, 18, 3, 18),
        };

        assert.deepEqual(route.additionalTextEdits, [expectedAdditionalEdit]);
    });

    it('should not insert route params if path()/url() has more than one parameter', async function () {
        let service = await getService();

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(5, 9),
        });

        let route = actual.items.filter(item => item.label === expectedRoute)[0];

        assert.ok(route.additionalTextEdits === undefined);
    });

    it('should work with complex route params', async function () {
        let service = await getService();

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(3, 17),
        });

        let route = actual.items.filter(item => item.label === 'test-url-2')[0];

        let expectedAdditionalEdit: TextEdit = {
            newText: ", {'year2': '', 'month2': ''}",
            range: Range.create(3, 18, 3, 18),
        };

        assert.deepEqual(route.additionalTextEdits, [expectedAdditionalEdit]);
    });
});
