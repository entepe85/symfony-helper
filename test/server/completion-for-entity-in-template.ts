import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position } from 'vscode-languageserver';

describe('completion for entity in template', function () {
    it('entity loaded from type-hinted repository', async function () {
        let service = await getService();
        let documentUri = projectUri + '/templates/books/1.html.twig';

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(0, 10),
        });

        let actualLabels = actual.items.map(row => row.label);

        let expectedLabels = ['title', 'author', 'year'];

        for (let label of expectedLabels) {
            assert.ok(actualLabels.indexOf(label) >= 0);
        }
    });

    it('entity loaded from entity manager (test 1)', async function () {
        let service = await getService();
        let documentUri = projectUri + '/templates/books/2.html.twig';

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(1, 14),
        });

        let actualLabels = actual.items.map(row => row.label);

        let expectedLabels = ['title', 'author', 'year'];

        for (let label of expectedLabels) {
            assert.ok(actualLabels.indexOf(label) >= 0);
        }
    });

    it('entity loaded from entity manager (test 2)', async function () {
        let service = await getService();
        let documentUri = projectUri + '/templates/books/3.html.twig';

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(1, 14),
        });

        let actualLabels = actual.items.map(row => row.label);

        let expectedLabels = ['title', 'author', 'year'];

        for (let label of expectedLabels) {
            assert.ok(actualLabels.indexOf(label) >= 0);
        }
    });

    it('entity loaded from entity manager (test 3, entity has no repository)', async function () {
        let service = await getService();
        let documentUri = projectUri + '/templates/books/4.html.twig';

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(1, 14),
        });

        let actualLabels = actual.items.map(row => row.label);

        let expectedLabels = ['title', 'abstract'];

        for (let label of expectedLabels) {
            assert.ok(actualLabels.indexOf(label) >= 0);
        }
    });

    it('entity from array of entities', async function () {
        let service = await getService();
        let documentUri = projectUri + '/templates/books/5.html.twig';

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(1, 12),
        });

        let actualLabels = actual.items.map(row => row.label);

        let expectedLabels = ['title', 'author', 'year'];

        for (let label of expectedLabels) {
            assert.ok(actualLabels.indexOf(label) >= 0);
        }
    });

    it('entity from query result', async function () {
        let service = await getService();
        let documentUri = projectUri + '/templates/books/6.html.twig';

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(0, 8),
        });

        let actualLabels = actual.items.map(row => row.label);

        let expectedLabels = ['title', 'author', 'year'];

        for (let label of expectedLabels) {
            assert.ok(actualLabels.indexOf(label) >= 0);
        }
    });

    it('entity after array functions', async function () {
        let service = await getService();
        let documentUri = projectUri + '/templates/books/7.html.twig';

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(0, 8),
        });

        let actualLabels = actual.items.map(row => row.label);

        let expectedLabels = ['title', 'author', 'year'];

        for (let label of expectedLabels) {
            assert.ok(actualLabels.indexOf(label) >= 0);
        }
    });

    it('entity defined by @var', async function () {
        let service = await getService();
        let documentUri = projectUri + '/templates/books/8.html.twig';

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(0, 8),
        });

        let actualLabels = actual.items.map(row => row.label);

        let expectedLabels = ['title', 'author', 'year'];

        for (let label of expectedLabels) {
            assert.ok(actualLabels.indexOf(label) >= 0);
        }
    });

    it('should tolerate simple values instead of entities', async function () {
        let service = await getService();
        let documentUri = projectUri + '/templates/fixture-44.html.twig';

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(0, 8),
        });

        let actualLabels = actual.items.map(row => row.label);

        let expectedLabels = ['title', 'author', 'year'];

        for (let label of expectedLabels) {
            assert.ok(actualLabels.indexOf(label) >= 0);
        }
    });

    it('should not tolerate complex values instead of entities', async function () {
        let service = await getService();
        let documentUri = projectUri + '/templates/fixture-44.html.twig';

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(1, 9),
        });

        let actualLabels = actual.items.map(row => row.label);

        let unexpectedLabels = ['title', 'author', 'year'];

        for (let label of unexpectedLabels) {
            assert.ok(actualLabels.indexOf(label) < 0);
        }
    });
});
