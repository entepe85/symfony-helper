import * as assert from 'assert';
import { Definition, Range, Position } from 'vscode-languageserver';
import { projectUri, getService } from './_utils';

describe('yaml routing files', function () {
    it(`should support definition`, async function () {
        let fixtures: { from: [number, number], to: [number, number] | false }[] = [
            //// tests for "..." literal
            // outside of string literal
            { from: [6, 15], to: false },
            // edge of string literal
            { from: [6, 16], to: false },
            // class
            { from: [6, 17], to: [6, 0] },
            { from: [6, 45], to: [6, 0] },
            // inside of '::'
            { from: [6, 46], to: false },
            // method
            { from: [6, 47], to: [8, 4] },
            { from: [6, 52], to: [8, 4] },
            // edge of string literal
            { from: [6, 53], to: false },

            //// tests for unquoted literal
            { from: [8, 28], to: false },
            { from: [8, 29], to: [6, 0] },
            { from: [8, 56], to: [6, 0] },
            { from: [8, 57], to: false },
            { from: [8, 58], to: [13, 4] },
            { from: [8, 63], to: [13, 4] },
            { from: [8, 64], to: false },

            //// tests for '...' literal
            { from: [10, 28], to: false },
            { from: [10, 29], to: false },
            { from: [10, 30], to: [6, 0] },
            { from: [10, 56], to: [6, 0] },
            { from: [10, 57], to: false },
            { from: [10, 58], to: [18, 4] },
            { from: [10, 63], to: [18, 4] },
            { from: [10, 64], to: false },
            { from: [10, 65], to: false },

            // tests for unfinished classes
            { from: [12, 37], to: false },
            { from: [12, 38], to: [6, 0] },
            { from: [12, 64], to: [6, 0] },
            { from: [12, 65], to: false },
            // ----
            { from: [14, 36], to: false },
            { from: [14, 37], to: [6, 0] },
            { from: [14, 64], to: [6, 0] },
            { from: [14, 65], to: false },
            { from: [14, 65], to: false },
        ];

        for (let i = 0; i < fixtures.length; i++) {
            let row = fixtures[i];

            let service = await getService();

            let actual = await service.onDefinition({
                textDocument: { uri: projectUri + '/config/routes.yaml' },
                position: Position.create(row.from[0], row.from[1]),
            });

            let expected: Definition | null = null;
            if (row.to !== false) {
                expected = {
                    uri: projectUri + '/src/Controller/GController.php',
                    range: Range.create(row.to[0], row.to[1], row.to[0], row.to[1]),
                };
            }

            assert.deepEqual(actual, expected, `fixture ${i} failed`);
        }
    });

    it(`should support definition for 'routes/' folder`, async function () {
        let service = await getService();

        let actual = await service.onDefinition({
            textDocument: { uri: projectUri + '/config/routes/more.yaml' },
            position: Position.create(2, 52),
        });

        let expected: Definition = {
            uri: projectUri + '/src/Controller/GController.php',
            range: Range.create(23, 4, 23, 4),
        };

        assert.deepEqual(actual, expected);
    });

    {
        let fixtures: { from: [number, number], to: boolean }[] = [
            { from: [1, 13], to: false },
            { from: [1, 14], to: true },
            { from: [1, 15], to: true },
            { from: [1, 62], to: true },
            { from: [1, 63], to: true },
        ];

        for (let i = 0; i < fixtures.length; i++) {
            let row = fixtures[i];

            it(`should support definition of routing resource from 'vendor/' (test ${i+1})`, async function () {
                let service = await getService();

                let actual = await service.onDefinition({
                    textDocument: { uri: projectUri + '/config/routes/dev/twig.yaml' },
                    position: Position.create(row.from[0], row.from[1]),
                });

                let expected: Definition | null = null;
                if (row.to) {
                    expected = {
                        uri: projectUri + '/vendor/symfony/twig-bundle/Resources/config/routing/errors.xml',
                        range: Range.create(0, 0, 0, 0),
                    };
                }

                assert.deepEqual(actual, expected);
            });
        }
    }

    it('should support hover over method name', async function () {
        let service = await getService();

        let actual = await service.onHover({
            textDocument: { uri: projectUri + '/config/routes.yaml' },
            position: Position.create(16, 58),
        }) as any;

        assert.ok(actual.contents.value.indexOf('Returns page 5') >= 0);
    });
});
