import * as assert from 'assert';
import { Range, Position } from 'vscode-languageserver';
import { projectUri, getService } from './_utils';

describe('jump to variable or function from template', function () {
    it('should work', async function () {
        let service = await getService();

        let documentUri = projectUri + '/templates/fixture-11.html.twig';

        {
            // jump to global defined in 'twig.yaml'

            // left edge
            {
                let actual = await service.onDefinition({
                    textDocument: { uri: documentUri },
                    position: Position.create(4, 16),
                });

                let expected = {
                    uri: projectUri + '/config/packages/twig.yaml',
                    range: Range.create(6, 8, 6, 8),
                };

                assert.deepEqual(actual, expected);
            }

            // right edge
            {
                let actual = await service.onDefinition({
                    textDocument: { uri: documentUri },
                    position: Position.create(4, 23),
                });

                let expected = {
                    uri: projectUri + '/config/packages/twig.yaml',
                    range: Range.create(6, 8, 6, 8),
                };

                assert.deepEqual(actual, expected);
            }
        }

        {
            // jump to function defined in 'src/Twig/'

            // left edge
            {
                let actual = await service.onDefinition({
                    textDocument: { uri: documentUri },
                    position: Position.create(5, 20),
                });

                let expected = {
                    uri: projectUri + '/src/Twig/AppExtension.php',
                    range: Range.create(19, 4, 19, 4),
                };

                assert.deepEqual(actual, expected);
            }

            // right edge
            {
                let actual = await service.onDefinition({
                    textDocument: { uri: documentUri },
                    position: Position.create(5, 29),
                });

                let expected = {
                    uri: projectUri + '/src/Twig/AppExtension.php',
                    range: Range.create(19, 4, 19, 4),
                };

                assert.deepEqual(actual, expected);
            }
        }

        {
            // jump to filter defined in 'src/Twig/'

            let actual = await service.onDefinition({
                textDocument: { uri: documentUri },
                position: Position.create(6, 20),
            });

            let expected = {
                uri: projectUri + '/src/Twig/ExtensionC.php',
                range: Range.create(21, 4, 21, 4),
            };

            assert.deepEqual(actual, expected);
        }

        {
            // jump to test defined in 'src/Twig/'

            let actual = await service.onDefinition({
                textDocument: { uri: documentUri },
                position: Position.create(7, 16),
            });

            let expected = {
                uri: projectUri + '/src/Twig/ExtensionB.php',
                range: Range.create(16, 4, 16, 4),
            };

            assert.deepEqual(actual, expected);
        }
    });
});
