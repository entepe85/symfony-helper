import * as assert from 'assert';
import { Definition, Range, Position } from 'vscode-languageserver';
import { projectUri, getService } from './_utils';

describe('jump to the same block in parent template from {% block %}', function () {
    it('should work', async function () {
        let service = await getService();

        {
            // jump to parent template

            let fixtures = [
                [4, 9],
                [4, 16]
            ];

            for (let row of fixtures) {
                let actual = await service.onDefinition({
                    textDocument: { uri: projectUri + '/templates/fixture-4.html.twig' },
                    position: Position.create(row[0], row[1]),
                });

                let expected: Definition = [{
                    uri: projectUri + '/templates/special-layout.html.twig',
                    range: Range.create(4, 4, 4, 4),
                }];

                assert.deepEqual(actual, expected);
            }

        }

        {
            // jump to parent of parent

            let fixtures = [
                [2, 9],
                [2, 14],
            ];

            for (let row of fixtures) {
                let actual = await service.onDefinition({
                    textDocument: { uri: projectUri + '/templates/fixture-4.html.twig' },
                    position: Position.create(row[0], row[1]),
                });

                let expected: Definition = [{
                    uri: projectUri + '/templates/base.html.twig',
                    range: Range.create(4, 7, 4, 7),
                }];

                assert.deepEqual(actual, expected);
            }
        }

        {
            // find all definitions in parents

            let actual = await service.onDefinition({
                textDocument: { uri: projectUri + '/templates/t1-final.twig' },
                position: Position.create(5, 9),
            });

            let expected: Definition = [
                {
                    uri: projectUri + '/templates/t1-b1.twig',
                    range: Range.create(4, 0, 4, 0),
                },
                {
                    uri: projectUri + '/templates/t1-b2.twig',
                    range: Range.create(2, 0, 2, 0),
                }
            ];

            assert.deepEqual(actual, expected);
        }
    });
});
