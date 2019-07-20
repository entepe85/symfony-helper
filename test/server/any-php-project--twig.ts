import * as assert from 'assert';
import { Position, Range, Definition } from 'vscode-languageserver';
import { projectAnyPhpUri, getService } from './_utils';

describe('twig in any php project', function () {
    it('should support definition', async function () {
        let service = await getService();

        let fixtures: { from: [number, number], to: [string, number, number] }[] = [
            { from: [0, 12], to: ['/views/layout.twig', 0, 0] },
        ];

        for (let i = 0; i < fixtures.length; i++) {
            let { from, to } = fixtures[i];

            let actual = await service.onDefinition({
                textDocument: { uri: projectAnyPhpUri + '/views/catalog/index.twig' },
                position: Position.create(from[0], from[1]),
            });

            let expected: Definition  = {
                uri: projectAnyPhpUri + to[0],
                range: Range.create(to[1], to[2], to[1], to[2]),
            };

            assert.deepEqual(actual, expected, `fixture ${i} failed`);
        }
    });
});
