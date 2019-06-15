import * as assert from 'assert';
import { Position, Range, CompletionItem } from 'vscode-languageserver';
import { projectUri, getService } from './_utils';

describe('autocomplete variable or function in template', function () {
    it('should work', async function () {
        let service = await getService();

        let documentUri = projectUri + '/templates/fixture-12.html.twig';

        {
            // full test for one global
            let actual = await service.onCompletition({
                textDocument: { uri: documentUri },
                position: Position.create(4, 8),
            });

            let actualCompletion = actual.items.filter(row => row.label === 'globalA')[0];

            let expectedCompletion: CompletionItem = {
                label: 'globalA',
                kind: 6,
                textEdit: {
                    range: Range.create(4, 6, 4, 8),
                    newText: 'globalA',
                },
                detail: 'twig.yaml',
            };

            assert.deepEqual(actualCompletion, expectedCompletion);
        }

        {
            let actual = await service.onCompletition({
                textDocument: { uri: documentUri },
                position: Position.create(4, 8),
            });

            let actualLabels = actual.items.map(row => row.label);

            let expectedLabels = [
                'functionA', // defined in extension
                'param', // defined in 'render()' call
                'globalA', // defined in 'twig.yaml'
            ];

            for (let label of expectedLabels) {
                assert.ok(actualLabels.indexOf(label) >= 0);
            }

            let unexpectedLabels = ['testA', 'filterA'];
            for (let label of unexpectedLabels) {
                assert.ok(actualLabels.indexOf(label) < 0);
            }
        }

        {
            // test {% filter %}
            let actual = await service.onCompletition({
                textDocument: { uri: documentUri },
                position: Position.create(6, 10),
            });

            let actualLabels = actual.items.map(row => row.label);

            let expectedLabels = ['filterA', 'filterB'];
            for (let label of expectedLabels) {
                assert.ok(actualLabels.indexOf(label) >= 0);
            }

            let unexpectedLabels = ['globalA', 'param', 'functionA', 'testA'];
            for (let label of unexpectedLabels) {
                assert.ok(actualLabels.indexOf(label) < 0);
            }
        }

        {
            // test ' | '
            let actual = await service.onCompletition({
                textDocument: { uri: documentUri },
                position: Position.create(9, 15),
            });

            let actualLabels = actual.items.map(row => row.label);

            let expectedLabels = ['filterA', 'filterB'];
            for (let label of expectedLabels) {
                assert.ok(actualLabels.indexOf(label) >= 0);
            }

            let unexpectedLabels = ['globalA', 'param', 'functionA', 'testA'];
            for (let label of unexpectedLabels) {
                assert.ok(actualLabels.indexOf(label) < 0);
            }
        }

        {
            // show only tests after 'is' and 'is not'
            let fixtures = [
                [11, 13],
                [14, 17],
            ];

            let expectedLabels = ['testA', 'testB'];
            let unexpectedLabels = ['globalA', 'param', 'functionA', 'filterA'];

            for (let row of fixtures) {
                let actual = await service.onCompletition({
                    textDocument: { uri: documentUri },
                    position: Position.create(row[0], row[1]),
                });

                let actualLabels = actual.items.map(row => row.label);

                for (let label of expectedLabels) {
                    assert.ok(actualLabels.indexOf(label) >= 0);
                }

                for (let label of unexpectedLabels) {
                    assert.ok(actualLabels.indexOf(label) < 0);
                }
            }
        }
    });

    it('should not work in route name in path() in particular', async function () {
        let service = await getService();

        let documentUri = projectUri + '/templates/fixture-27.html.twig';

        let names = ['path', 'globalA'];

        {
            // test that globals and functions exist
            let actual = await service.onCompletition({
                textDocument: { uri: documentUri },
                position: Position.create(3, 3),
            });

            let actualLabels = actual.items.map(row => row.label);

            let expectedLabels = names;

            for (let label of expectedLabels) {
                assert.ok(actualLabels.indexOf(label) >= 0);
            }
        }

        {
            // test that globals and functions don't used
            let actual = await service.onCompletition({
                textDocument: { uri: documentUri },
                position: Position.create(4, 9),
            });

            let actualLabels = actual.items.map(row => row.label);

            let unexpectedLabels = names;

            for (let label of unexpectedLabels) {
                assert.ok(actualLabels.indexOf(label) < 0);
            }
        }
    });
});
