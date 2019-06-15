import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position } from 'vscode-languageserver';

describe('local variables in templates', function () {
    it('should support completion in templates with {% extends %}', async function () {
        let service = await getService();
        let documentUri = projectUri + '/templates/fixture-35.html.twig';

        let fixtures = [
            { position: [15, 5], expectedLabels: ['var1'], unexpectedLabels: ['var2', 'var5', 'var6'] },
            { position: [26, 5], expectedLabels: ['var3', 'var4'], unexpectedLabels: ['var1', 'var2'] },
            { position: [10, 9], expectedLabels: ['var1', 'var5', 'var6'], unexpectedLabels: ['var2'] },
        ];

        for (let i = 0; i < fixtures.length; i++) {
            let { position, expectedLabels, unexpectedLabels } = fixtures[i];

            let actual = await service.onCompletition({
                textDocument: { uri: documentUri },
                position: Position.create(position[0], position[1]),
            });

            let actualLabels = actual.items.map(row => row.label);

            for (let label of expectedLabels) {
                assert.ok(actualLabels.indexOf(label) >= 0, `could not find label '${label}' of fixture ${i}`);
            }

            for (let label of unexpectedLabels) {
                assert.ok(actualLabels.indexOf(label) < 0, `unexpected label '${label}' for fixture ${i}`);
            }
        }
    });

    it('should support completion in templates without {% extends %}', async function () {
        let service = await getService();
        let documentUri = projectUri + '/templates/fixture-36.html.twig';

        let fixtures = [
            { position: [4, 9], expectedLabels: ['var1', 'var2', 'var3'], unexpectedLabels: ['var4'] },
            { position: [7, 5], expectedLabels: ['var1'], unexpectedLabels: ['var2', 'var3', 'var4'] },
            { position: [12, 5], expectedLabels: ['var1', 'var4'], unexpectedLabels: ['var2', 'var3'] },
        ];

        for (let { position, expectedLabels, unexpectedLabels } of fixtures) {
            let actual = await service.onCompletition({
                textDocument: { uri: documentUri },
                position: Position.create(position[0], position[1]),
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
});
