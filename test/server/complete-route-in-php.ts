import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position, TextEdit, Range } from 'vscode-languageserver';

describe('complete route in php', function () {
    it('AbstractController#generateUrl(), path without params', async function () {
        let service = await getService();

        let documentUri = projectUri + '/src/Controller/K1Controller.php';

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(13, 34),
        });

        let actualLabels = actual.items.map(row => row.label);

        let expectedLabels = ['page-k1'];

        for (let label of expectedLabels) {
            assert.ok(actualLabels.indexOf(label) >= 0);
        }
    });

    it('UrlGeneratorInterface#generate(), path with params, only one argument in call', async function () {
        let service = await getService();

        let documentUri = projectUri + '/src/Logic/ServiceA.php';

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(9, 33),
        });

        let item = actual.items.filter(item => item.label === 'test-url-1')[0];

        let expectedAdditionalEdit: TextEdit = {
            newText: ", ['year' => '', 'month' => '']",
            range: Range.create(9, 34, 9, 34),
        };

        assert.deepEqual(item.additionalTextEdits, [expectedAdditionalEdit]);
    });

    it('UrlGeneratorInterface#generate(), path with params, two arguments in call', async function () {
        let service = await getService();

        let documentUri = projectUri + '/src/Logic/ServiceA.php';

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(10, 33),
        });

        let item = actual.items.filter(item => item.label === 'test-url-1')[0];

        assert.ok(item.additionalTextEdits === undefined);
    });
});
