import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position } from 'vscode-languageserver';

describe('completion in twig', function () {
    // don't change this test blindly because some other tests check for non-existence of items used here
    it('should always have these items', async function () {
        let service = await getService();
        let documentUri = projectUri + '/templates/fixture-30.html.twig';

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(3, 3),
        });

        let actualLabels = actual.items.map(row => row.label);

        let expectedLabels = ['app', 'globalA', 'functionA'];

        for (let label of expectedLabels) {
            assert.ok(actualLabels.indexOf(label) >= 0);
        }
    });

    it('should not autocomplete in strings in not special cases', async function () {
        let service = await getService();
        let documentUri = projectUri + '/templates/fixture-31.html.twig';

        let fixtures = [
            [3, 4],
            [4, 6],
            [5, 8],
            [5, 9],
            [5, 10],
            [5, 11],
        ];

        for (let [line, character] of fixtures) {
            let actual = await service.onCompletition({
                textDocument: { uri: documentUri },
                position: Position.create(line, character),
            });

            assert.equal(actual.items.length, 0);
        }
    });

    it('should not autocomplete in broken strings in not special cases', async function () {
        let service = await getService();
        let documentUri = projectUri + '/templates/fixture-32.html.twig';

        let fixtures = [
            [3, 4],
            [4, 6],
            [5, 8],
            [5, 9],
            [5, 10],
            [5, 11],
        ];

        for (let [line, character] of fixtures) {
            let actual = await service.onCompletition({
                textDocument: { uri: documentUri },
                position: Position.create(line, character),
            });

            assert.equal(actual.items.length, 0);
        }
    });
});
