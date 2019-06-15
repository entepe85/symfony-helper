import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position, Definition, Range } from 'vscode-languageserver';

describe('container parameters', function () {
    let documentUri = projectUri + '/src/Controller/FController.php';

    it('autocomplete in controllers', async function () {
        let service = await getService();

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(13, 31),
        });

        let actualLabels = actual.items.map(row => row.label);

        let expectedLabels = ['asset.request_context.base_path', 'form.type_extension.csrf.enabled', 'kernel.debug'];

        for (let label of expectedLabels) {
            assert.ok(actualLabels.indexOf(label) >= 0);
        }
    });

    it('hover in controllers', async function () {
        let service = await getService();

        let actual = await service.onHover({
            textDocument: { uri: documentUri },
            position: Position.create(15, 29),
        }) as any;

        let markup: string = actual.contents.value;

        assert.ok(markup.includes('_token'));
    });

    it(`definition in controllers for parameters from 'config/services.yaml'`, async function () {
        let service = await getService();

        let actual = await service.onDefinition({
            textDocument: { uri: documentUri },
            position: Position.create(17, 29),
        });

        let expected: Definition = {
            uri: projectUri + '/config/services.yaml',
            range: Range.create(7, 4, 7, 4),
        };

        assert.deepEqual(actual, expected);
    });
});
