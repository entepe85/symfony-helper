import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position, Definition, Range } from 'vscode-languageserver';

describe('jump to controller from route name in AbstractController', function () {
    it('should work', async function () {
        let service = await getService();

        let documentUri = projectUri + '/src/Controller/K2Controller.php';

        let actual = await service.onDefinition({
            textDocument: { uri: documentUri },
            position: Position.create(13, 30),
        });

        let expected: Definition = {
            uri: documentUri,
            range: Range.create(11, 4, 11, 4),
        };

        assert.deepEqual(actual, expected);
    });
});
