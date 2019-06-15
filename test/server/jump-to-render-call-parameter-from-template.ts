import * as assert from 'assert';
import { Range, Position } from 'vscode-languageserver';
import { projectUri, getService } from './_utils';

describe('jump to render call parameter in controller from template', function () {
    it('should work', async function () {
        let service = await getService();

        let documentUri = projectUri + '/templates/fixture-19.html.twig';

        // left edge
        {
            let actual = await service.onDefinition({
                textDocument: { uri: documentUri },
                position: Position.create(4, 15),
            });

            let expected = [
                {
                    uri: projectUri + '/src/Controller/RController.php',
                    range: Range.create(15, 12, 15, 12),
                },
                {
                    uri: projectUri + '/src/Controller/RController.php',
                    range: Range.create(24, 79, 24, 79),
                },
            ];

            assert.deepEqual(actual, expected);
        }

        // right edge
        {
            let actual = await service.onDefinition({
                textDocument: { uri: documentUri },
                position: Position.create(4, 21),
            });

            let expected = [
                {
                    uri: projectUri + '/src/Controller/RController.php',
                    range: Range.create(15, 12, 15, 12),
                },
                {
                    uri: projectUri + '/src/Controller/RController.php',
                    range: Range.create(24, 79, 24, 79),
                },
            ];

            assert.deepEqual(actual, expected);
        }
    });
});
