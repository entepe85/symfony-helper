import * as assert from 'assert';
import { Position, Range, Definition } from 'vscode-languageserver';
import URI from 'vscode-uri';
import { project28Uri, getService } from './_utils';

describe('twig in symfony 2.8', function () {
    let templatesUri = project28Uri + '/app/Resources/views';

    it('should support definition', async function () {
        let service = await getService();

        let fixtures: { from: [number, number], to: [string, number, number] }[] = [
            { from: [0, 28], to: ['/app/Resources/views/layout.html.twig', 0, 0] },
            { from: [6, 21], to: ['/src/AppBundle/Controller/DefaultController.php', 13, 4] },
        ];

        for (let i = 0; i < fixtures.length; i++) {
            let { from, to } = fixtures[i];

            let actual = await service.onDefinition({
                textDocument: { uri: templatesUri + '/default/index.html.twig' },
                position: Position.create(from[0], from[1]),
            });

            let expected: Definition  = {
                uri: project28Uri + to[0],
                range: Range.create(to[1], to[2], to[1], to[2]),
            };

            assert.deepEqual(actual, expected, `fixture ${i} failed`);
        }
    });

    it('should support "Open Compiled Template" command', async function () {
        let service = await getService();

        let result = await service.commandOpenCompiledTemplate({ uri: project28Uri + '/app/Resources/views/layout.html.twig' });

        assert.ok(result.success);

        assert.ok(URI.file(result.message).toString().startsWith(project28Uri + '/app/cache/dev/twig') && result.message.endsWith('.php'));
    });
});
