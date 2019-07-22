import * as assert from 'assert';
import { Position, Range, Definition } from 'vscode-languageserver';
import { projectAnyPhpUri, getService } from './_utils';

describe('twig in non-symfony project', function () {
    it('should support definition', async function () {
        let service = await getService();

        let fixtures: { from: [string, number, number], to: [string, number, number] }[] = [
            { from: ['/views/catalog/index.twig', 0, 12], to: ['/views/layout.twig', 0, 0] },
            { from: ['/views/index.twig', 7, 22], to: ['/php-classes/Twig/ExtensionA.php', 15, 48] },
        ];

        for (let i = 0; i < fixtures.length; i++) {
            let { from, to } = fixtures[i];

            let actual = await service.onDefinition({
                textDocument: { uri: projectAnyPhpUri + from[0] },
                position: Position.create(from[1], from[2]),
            });

            let expected: Definition  = {
                uri: projectAnyPhpUri + to[0],
                range: Range.create(to[1], to[2], to[1], to[2]),
            };

            assert.deepEqual(actual, expected, `fixture ${i} failed`);
        }
    });

    it('should ignore "Open Compiled Template" command', async function () {
        let service = await getService();

        let result = await service.commandOpenCompiledTemplate({ uri: projectAnyPhpUri + '/views/layout.twig' });

        assert.ok(result.success === false);
        assert.ok(result.message.includes('only for symfony projects'));
    });
});
