import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position, Definition, Range, MarkupKind } from 'vscode-languageserver';

describe('UrlGeneratorInterface', function () {
    let documentUri = projectUri + '/src/Controller/K4Controller.php';

    it('should support completion', async function () {
        let service = await getService();

        let fixtures = [
            [13, 32],
            [13, 39],
        ];

        let expectedLabels = ['page-k1', 'page-k4'];

        for (let [line, character] of fixtures) {
            let actual = await service.onCompletition({
                textDocument: { uri: documentUri },
                position: Position.create(line, character),
            });

            let actualLabels = actual.items.map(row => row.label);

            for (let label of expectedLabels) {
                assert.ok(actualLabels.indexOf(label) >= 0);
            }
        }
    });

    it('should support definition', async function () {
        let service = await getService();

        let fixtures = [
            [13, 32],
            [13, 39],
        ];

        for (let [line, character] of fixtures) {
            let actual = await service.onDefinition({
                textDocument: { uri: documentUri },
                position: Position.create(line, character),
            });

            let expected: Definition = {
                uri: projectUri + '/src/Controller/K1Controller.php',
                range: Range.create(11, 4, 11, 4),
            };

            assert.deepEqual(actual, expected);
        }
    });

    it('should support hover', async function () {
        let service = await getService();

        let fixtures = [
            [13, 32],
            [13, 39],
        ];

        for (let [line, character] of fixtures) {
            let actual: any = await service.onHover({
                textDocument: { uri: documentUri },
                position: Position.create(line, character),
            });

            assert.deepEqual(actual.range, Range.create(13, 31, 13, 40));
            assert.equal(actual.contents.kind, MarkupKind.Markdown);
            assert.ok(actual.contents.value.indexOf('/k1') >= 0);
            assert.ok(actual.contents.value.indexOf('App\\Controller\\K1Controller::page') >= 0);
        }
    });
});
