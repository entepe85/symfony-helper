import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position, Definition, Range } from 'vscode-languageserver';

describe('jump to service definition from get() call in AbstractController', function () {
    it('should work', async function () {
        let service = await getService();

        let documentUri = projectUri + '/src/Controller/TController.php';

        let actual = await service.onDefinition({
            textDocument: { uri: documentUri },
            position: Position.create(13, 20),
        });

        let expected: Definition = {
            uri: projectUri + '/vendor/symfony/security-bundle/Resources/config/security.xml',
            range: Range.create(15, 8, 15, 8),
        };

        assert.deepEqual(actual, expected);
    });
});
