import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position } from 'vscode-languageserver';

describe('autocomplete services in get() call in AbstractController', function () {
    it('should work', async function () {
        let service = await getService();

        let documentUri = projectUri + '/src/Controller/HController.php';

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(13, 22),
        });

        let actualLabels = actual.items.map(row => row.label);

        let expectedLabels = [
            'doctrine',
            'form.factory',
            'http_kernel',
            'parameter_bag',
            'request_stack',
            'router',
            'security.authorization_checker',
            'security.csrf.token_manager',
            'security.token_storage',
            'serializer',
            'session',
            'twig',
        ];

        let unexpectedLabels = ['translator', 'twig.loader', 'validator'];

        for (let label of expectedLabels) {
            assert.ok(actualLabels.indexOf(label) >= 0);
        }

        for (let label of unexpectedLabels) {
            assert.ok(actualLabels.indexOf(label) < 0);
        }
    });
});
