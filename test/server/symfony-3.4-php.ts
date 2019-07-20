import * as assert from 'assert';
import { Position, Range, Definition } from 'vscode-languageserver';
import { project34Uri, getService } from './_utils';

describe('php in symfony 3.4', function () {
    let controllersUri = project34Uri + '/src/AppBundle/Controller';

    it('should support definition for dql', async function () {
        let service = await getService();

        let fixtures = [
            { from: [20, 17], to: [12, 0] },
            { from: [21, 20], to: [35, 4] },
        ];

        for (let i = 0; i < fixtures.length; i++) {
            let { from, to } = fixtures[i];

            let actual = await service.onDefinition({
                textDocument: { uri: controllersUri + '/CatalogController.php' },
                position: Position.create(from[0], from[1]),
            });

            let expected: Definition  = {
                uri: project34Uri + '/src/AppBundle/Entity/Product.php',
                range: Range.create(to[0], to[1], to[0], to[1]),
            };

            assert.deepEqual(actual, expected, `fixture ${i} failed`);
        }
    });

    it('should support definition for services', async function () {
        let service = await getService();

        let actual = await service.onDefinition({
            textDocument: { uri: controllersUri + '/DefaultController.php' },
            position: Position.create(15, 38),
        });

        let expected: Definition  = {
            uri: project34Uri + '/vendor/symfony/symfony/src/Symfony/Bundle/FrameworkBundle/Resources/config/form.xml',
            range: Range.create(104, 8, 104, 8),
        };

        assert.deepEqual(actual, expected);
    });
});
