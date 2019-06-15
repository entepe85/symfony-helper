import * as assert from 'assert';
import { Definition, Range, Position } from 'vscode-languageserver';
import { projectUri, getService } from './_utils';

describe('jump to parent template from {% extends %}', function () {
    it('should work', async function () {
        let service = await getService();

        let fixtures: [number, number, string|null][] = [
            // test all edges
            [0, 10, null],
            [0, 11, 'base.html.twig'],
            [0, 20, 'base.html.twig'],
            [0, 27, 'base.html.twig'],
            [0, 28, null],
            // test double quotes
            [3, 18, '_part.html.twig'],
            // test second in line, with slash and dash and as function param
            [4, 49, 'pieces/_part-2.html.twig'],
        ];

        for (let row of fixtures) {
            let actual = await service.onDefinition({
                textDocument: { uri: projectUri + '/templates/fixture-1.html.twig' },
                position: Position.create(row[0], row[1]),
            });

            let expected: Definition | null;
            if (row[2] === null) {
                expected = null;
            } else {
                expected = {
                    uri: projectUri + '/templates/' + row[2],
                    range: Range.create(0, 0, 0, 0),
                };
            }

            assert.deepEqual(actual, expected);
        }
    });
});
