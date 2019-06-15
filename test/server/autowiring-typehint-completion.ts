import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position, Range, TextEdit } from 'vscode-languageserver';

describe('complete autowiring typehint', function () {
    let prefix = '.';

    it('should work after dot and after bracket', async function () {
        let service = await getService();

        let documentUri = projectUri + '/src/Controller/AFakeController.php';

        let expectedLabels = [
            prefix + 'CacheInterface',
            prefix + 'cache.app',
            prefix + 'FormFactoryInterface',
            prefix + 'form.factory',
            prefix + 'Twig_Environment',
            prefix + 'twig',
        ];

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(11, 26),
        });

        let actualLabels = actual.items.map(row => row.label);

        for (let label of expectedLabels) {
            assert.ok(actualLabels.indexOf(label) >= 0);
        }
    });

    it('should have proper range', async function () {
        let service = await getService();

        let documentUri = projectUri + '/src/Controller/AFakeController.php';

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(11, 33),
        });

        let item = actual.items.filter(row => row.label === '.FormFactoryInterface')[0];

        assert.deepEqual(item.textEdit!.range, Range.create(11, 30, 11, 33));
    });

    it('should work after some symbols and after comma and before bracket', async function () {
        let service = await getService();

        let documentUri = projectUri + '/src/Controller/AFakeController.php';

        let expectedLabels = [
            prefix + 'FormFactoryInterface',
            prefix + 'form.factory',
        ];

        // because I have custom filter 'String#includes()'
        let unexpectedLabels = [
            prefix + 'Twig_Environment',
            prefix + 'twig',
        ];

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(11, 33),
        });

        let actualLabels = actual.items.map(row => row.label);

        for (let label of expectedLabels) {
            assert.ok(actualLabels.indexOf(label) >= 0);
        }

        for (let label of unexpectedLabels) {
            assert.ok(actualLabels.indexOf(label) < 0);
        }
    });

    it('should generate proper argument names from classnames', async function () {
        let service = await getService();

        let documentUri = projectUri + '/src/Controller/AFakeController.php';

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(11, 26),
        });

        // [label, argument]
        let expectedArgumentNames = [
            [prefix + 'FormFactoryInterface', 'formFactory'], // test for classname ending with 'Interface'
            [prefix + 'RequestContext', 'requestContext'], // test for classname not ending with 'Interface'
            [prefix + 'twig', 'twigEnvironment'], // test for classname with '_'
        ];

        for (let [label, argumentName] of expectedArgumentNames) {
            let item = actual.items.filter(row => row.label === label)[0];
            let newText = item.textEdit!.newText;
            assert.ok(newText.endsWith(' $' + argumentName));
        }
    });

    it('should create \'use statements\' or use existing ones', async function () {
        let service = await getService();

        let documentUri = projectUri + '/src/Controller/BFakeController.php';

        {
            // ignore classes without '\'
            let actual = await service.onCompletition({
                textDocument: { uri: documentUri },
                position: Position.create(12, 28),
            });

            let item = actual.items.filter(row => row.label === '.twig')[0];
            assert.ok(item.additionalTextEdits === undefined);
            assert.ok(item.textEdit!.newText.startsWith('\\Twig_Environment '));
        }

        {
            // use existing 'use statement'
            let actual = await service.onCompletition({
                textDocument: { uri: documentUri },
                position: Position.create(12, 34),
            });

            let item = actual.items.filter(row => row.label === '.EntityManagerInterface')[0];

            assert.ok(item.additionalTextEdits === undefined);
            assert.ok(item.textEdit!.newText.startsWith('EMI '));
        }

        {
            // create new 'use statement'
            let actual = await service.onCompletition({
                textDocument: { uri: documentUri },
                position: Position.create(12, 40),
            });

            let item = actual.items.filter(row => row.label === '.RequestStack')[0];

            let expectedAdditionalEdits: TextEdit[] = [
                {
                    newText: 'use Symfony\\Component\\HttpFoundation\\RequestStack;\n', // is this '\n' cross-platform?
                    range: Range.create(6, 0, 6, 0),
                },
            ];

            assert.ok(item.textEdit!.newText.startsWith('RequestStack '));
            assert.deepEqual(item.additionalTextEdits, expectedAdditionalEdits);
        }
    });

    it('should support http-request autowiring', async function () {
        let service = await getService();

        let documentUri = projectUri + '/src/Controller/AFakeController.php';

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(11, 26),
        });

        let item = actual.items.filter(row => row.label === '.Request')[0];

        assert.ok(item !== undefined);
        assert.equal(item.additionalTextEdits![0].newText, 'use Symfony\\Component\\HttpFoundation\\Request;\n');
    });

    it('should support entities as typehints (see @ParamConverter)', async function () {
        let service = await getService();

        let documentUri = projectUri + '/src/Controller/AFakeController.php';

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(11, 26),
        });

        let item = actual.items.filter(row => row.label === '.Fixture1')[0];

        assert.ok(item !== undefined);
        assert.equal(item.additionalTextEdits![0].newText, 'use App\\Entity\\Fixture1;\n');
    });

    it('should support entity repositories', async function () {
        let service = await getService();

        let documentUri = projectUri + '/src/Controller/AFakeController.php';

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(11, 26),
        });

        let item = actual.items.filter(row => row.label === '.Books')[0];

        assert.ok(item !== undefined);
        assert.equal(item.additionalTextEdits![0].newText, 'use App\\Repository2\\Books;\n');
    });
});
