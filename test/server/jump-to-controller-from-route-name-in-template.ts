import * as assert from 'assert';
import { Definition, Range, Position } from 'vscode-languageserver';
import { projectUri, getService } from './_utils';

describe('jump to controller from route name in template', function () {
    {
        let c1 = 'EController.php';
        let c2 = 'Sub/FController.php';

        let fixtures: { position: [number, number], result: false|[string,number,number] }[] = [
            { position: [4, 40], result: [c1, 11, 4] }, // out of left edge of route name
            { position: [4, 41], result: [c1, 11, 4] }, // in left edge of route name
            { position: [4, 48], result: [c1, 11, 4] }, // in right edge of route name
            { position: [4, 49], result: [c1, 11, 4] }, // out of right edge of route name

            { position: [5, 129], result: false },
            { position: [5, 130], result: [c2, 11, 4] },
            { position: [5, 138], result: [c2, 11, 4] },
            { position: [5, 139], result: false },
        ];

        for (let i = 0; i < fixtures.length; i++) {
            let { position, result } = fixtures[i];

            it(`should work (test ${i+1})`, async function () {
                let service = await getService();

                let actual = await service.onDefinition({
                    textDocument: { uri: projectUri + '/templates/fixture-6.html.twig' },
                    position: Position.create(...position),
                });

                let expected: Definition | null = null;
                if (result) {
                    expected = {
                        uri: projectUri + '/src/Controller/' + result[0],
                        range: Range.create(result[1], result[2], result[1], result[2]),
                    };
                }

                assert.deepEqual(actual, expected);
            });
        }
    }
});
