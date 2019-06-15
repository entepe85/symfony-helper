import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position, Definition, Range } from 'vscode-languageserver';

describe('globals in template', function () {
    let documentUri = projectUri + '/templates/fixture-37.html.twig';

    it('should support hover', async function () {
        let service = await getService();

        let fixtures = [
            { point: [0, 3], pieces: ['config/packages/twig.yaml', 'globalA = 12'] },
            { point: [1, 3], pieces: ['src/Twig/Extension5.php']}
        ];

        for (let i = 0; i < fixtures.length; i++) {
            let { point, pieces } = fixtures[i];

            let actual: any = await service.onHover({
                textDocument: { uri: documentUri },
                position: Position.create(point[0], point[1]),
            });

            let markup: string = actual.contents.value;

            for (let piece of pieces) {
                assert.ok(markup.includes(piece), `could not find piece '${piece}' of fixture ${i}`);
            }
        }
    });

    it('should support definition', async function () {
        let service = await getService();

        let fixtures: { from: [number, number], to: [string, number, number] }[] = [
            { from: [0, 3], to: ['config/packages/twig.yaml', 5, 8] },
            { from: [1, 3], to: ['src/Twig/Extension5.php', 11, 12] },
        ];

        for (let i = 0; i < fixtures.length; i++) {
            let { from, to } = fixtures[i];

            let actual = await service.onDefinition({
                textDocument: { uri: documentUri },
                position: Position.create(from[0], from[1]),
            });

            let expected: Definition = {
                uri: projectUri + '/' + to[0],
                range: Range.create(to[1], to[2], to[1], to[2]),
            };

            assert.deepEqual(actual, expected, `fixture ${i} failed`);
        }
    });

    it('should support completion', async function () {
        let service = await getService();

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(0, 3),
        });

        let actualLabels = actual.items.map(row => row.label);

        let expectedLabels = ['globalA', 'globalC'];

        for (let label of expectedLabels) {
            assert.ok(actualLabels.indexOf(label) >= 0, `could not find label '${label}'`);
        }
    });
});
