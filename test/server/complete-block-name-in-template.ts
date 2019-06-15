import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position } from 'vscode-languageserver';

describe('complete block name in {% block %}', function () {
    let documentUri = projectUri + '/templates/t1-final.twig';

    it('should work', async function () {
        let service = await getService();

        let positions = [
            [2, 9],
            [2, 11],
        ];

        for (let [line, character] of positions) {
            let actual = await service.onCompletition({
                textDocument: { uri: documentUri },
                position: Position.create(line, character),
            });

            let actualLabels = actual.items.map(row => row.label);

            let expectedLabels = ['t_line', 't_text', 't_footer', 't_realContent'];

            for (let label of expectedLabels) {
                assert.ok(actualLabels.indexOf(label) >= 0);
            }

            let unexpectedLabels = ['app', 'globalA', 'functionA'];
            for (let label of unexpectedLabels) {
                assert.ok(actualLabels.indexOf(label) < 0);
            }
        }
    });
});
