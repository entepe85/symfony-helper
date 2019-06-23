import * as assert from 'assert';
import { Definition, Position, Range } from 'vscode-languageserver';
import { projectUri, getService } from './_utils';

describe('jump to twig template from php-string with template path', function () {
    it('should work', async function () {
        let service = await getService();

        let fixtures: { position: [number, number], result: boolean }[] = [
            { position: [13, 16], result: false }, // left edge out of string
            { position: [13, 17], result: true }, // left edge in string
            { position: [13, 36], result: true }, // right edge in string
            { position: [13, 37], result: false }, // right edge out of string
        ];

        for (let { position, result } of fixtures) {
            let actual = await service.onDefinition({
                textDocument: { uri: projectUri + '/src/Controller/AController.php' },
                position: Position.create(...position),
            });

            let expected: Definition | null = null;
            if (result) {
                expected = [{
                    uri: projectUri + '/templates/fixture-3.html.twig',
                    range: Range.create(0, 0, 0, 0),
                }];
            }

            assert.deepEqual(actual, expected);
        }
    });
});
