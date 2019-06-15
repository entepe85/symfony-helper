import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position, Definition, Range } from 'vscode-languageserver';

describe('autowiring typehint', function () {
    let documentUri = projectUri + '/src/Controller/OController.php';

    {
        let fixtures: [number, number, string][] = [
            [12, 48, 'doctrine.orm.default_entity_manager'],
            [12, 51, 'doctrine.orm.default_entity_manager'],
            [12, 98, 'form.factory'],
            [12, 110, 'form.factory'],
        ];

        for (let i = 0; i < fixtures.length; i++) {
            let [line, character, serviceId] = fixtures[i];

            it(`should support hover over argument (test ${i+1})`, async function () {
                let service = await getService();

                let actual: any = await service.onHover({
                    textDocument: { uri: documentUri },
                    position: Position.create(line, character),
                });

                let markdown: string = actual.contents.value;

                assert.ok(markdown.includes(serviceId));
            });
        }
    }

    it('should support definition for argument', async function () {
        let service = await getService();

        let actual = await service.onDefinition({
            textDocument: { uri: documentUri },
            position: Position.create(12, 98),
        });

        let expected: Definition = {
            uri: projectUri + '/vendor/symfony/framework-bundle/Resources/config/form.xml',
            range: Range.create(29, 8, 29, 8),
        };

        assert.deepEqual(actual, expected);
    });
});
