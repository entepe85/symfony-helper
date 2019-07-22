import * as assert from 'assert';
import { Position, Range, Definition } from 'vscode-languageserver';
import { projectAnyPhpUri, getService } from './_utils';

describe('php in non-symfony project', function () {
    it('should support definition for dql', async function () {
        let service = await getService();

        let fixtures: { from: [string, number, number], to: [string, number, number] }[] = [
            { from: ['/php-functions/controllers-catalog.php', 3, 43], to: ['/php-classes/Entities/Product.php', 7, 0] },
            { from: ['/php-functions/controllers-catalog.php', 3, 78], to: ['/php-classes/Entities/Product.php', 19, 4] },
        ];

        for (let i = 0; i < fixtures.length; i++) {
            let { from, to } = fixtures[i];

            let actual = await service.onDefinition({
                textDocument: { uri: projectAnyPhpUri + from[0] },
                position: Position.create(from[1], from[2]),
            });

            let expected: Definition  = {
                uri: projectAnyPhpUri + to[0],
                range: Range.create(to[1], to[2], to[1], to[2]),
            };

            assert.deepEqual(actual, expected, `fixture ${i} failed`);
        }
    });
});
