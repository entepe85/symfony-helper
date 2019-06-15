import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position } from 'vscode-languageserver';

describe('complete in autoescape twig tag', function () {
    it('should work without quotes', async function () {
        let service = await getService();

        let documentUri = projectUri + '/templates/fixture-28.html.twig';

        let fixtures = [
            [4, 14],
            [4, 16],
        ];

        let expectedLabels = [
            `false`,
            `'html'`,
            `'js'`,
            `'css'`,
            `'url'`,
            `'html_attr'`,
        ];

        let unexpectedLabels = ['app', 'globalA', 'functionA'];

        for (let [line, character] of fixtures) {
            let actual = await service.onCompletition({
                textDocument: { uri: documentUri },
                position: Position.create(line, character),
            });

            let actualLabels = actual.items.map(row => row.label);

            for (let label of expectedLabels) {
                assert.ok(actualLabels.indexOf(label) >= 0);
            }

            for (let label of unexpectedLabels) {
                assert.ok(actualLabels.indexOf(label) < 0);
            }
        }
    });

    it('should work inside of quotes', async function () {
        let service = await getService();

        let documentUri = projectUri + '/templates/fixture-28.html.twig';

        let fixtures = [
            [7, 15],
            [7, 17],
        ];

        let expectedLabels = [
            'html',
            'js',
            'css',
            'url',
            'html_attr',
        ];

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
});
