import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position } from 'vscode-languageserver';

describe(`complete after 'app' variable in templates`, function () {
    it(`should work for first dot`, async function () {
        let service = await getService();
        let documentUri = projectUri + '/templates/fixture-33.html.twig';

        let fixtures = [
            [3, 7],
            [3, 10],
        ];

        let expectedLabels = ['user', 'request', 'environment'];
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

    it('should work for second dot', async function () {
        let service = await getService();
        let documentUri = projectUri + '/templates/fixture-33.html.twig';

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(4, 17),
        });

        let actualLabels = actual.items.map(row => row.label);

        let expectedLabels = ['clientIp', 'scheme'];
        let unexpectedLabels = ['app', 'globalA', 'functionA'];

        for (let label of expectedLabels) {
            assert.ok(actualLabels.indexOf(label) >= 0);
        }

        for (let label of unexpectedLabels) {
            assert.ok(actualLabels.indexOf(label) < 0);
        }
    });
});
