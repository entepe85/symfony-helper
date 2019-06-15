import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position, Definition, Range } from 'vscode-languageserver';

describe('dql embeddables', function () {
    it('should support definition', async function () {
        let service = await getService();

        let documentUri = projectUri + '/src/Controller/DQL12Controller.php';

        let fixtures: { from: [number, number], to: [string, number, number] }[] = [
            // embedded field
            { from: [14, 28], to: ['Entity/E5.php', 23, 4] },
            { from: [14, 34], to: ['Entity/E5.php', 23, 4] },
            { from: [16, 27], to: ['Entity/E5.php', 23, 4] },

            // fields of embedded field
            { from: [14, 35], to: ['Entity/Embed1.php', 25, 4] },
            { from: [16, 34], to: ['Entity/Embed1.php', 32, 4] },

            // field of embed of embed
            { from: [16, 39], to: ['Entity/Embed2.php', 20, 4] },
        ];

        for (let i = 0; i < fixtures.length; i++) {
            let { from, to } = fixtures[i];

            let actual = await service.onDefinition({
                textDocument: { uri: documentUri },
                position: Position.create(from[0], from[1]),
            })

            let expected: Definition = {
                uri: projectUri + '/src/' + to[0],
                range: Range.create(to[1], to[2], to[1], to[2]),
            };

            assert.deepEqual(actual, expected, `fixture ${i} failed`);
        }
    });

    it('should support hover', async function () {
        let service = await getService();

        let documentUri = projectUri + '/src/Controller/DQL12Controller.php';

        let actual: any = await service.onHover({
            textDocument: { uri: documentUri },
            position: Position.create(16, 35) ,
        });

        assert.ok(actual.contents.value.indexOf('Summary of $num2') >= 0);
    });

    it('should support completion', async function () {
        let service = await getService();

        let documentUri = projectUri + '/src/Controller/DQL12Controller.php';

        let fixtures = [
            { point: [16, 21], expectedLabels: ['embed1'] },
            { point: [16, 28], expectedLabels: ['num', 'str', 'embed2'] },
            { point: [16, 35], expectedLabels: ['num2', 'str2'] },
        ];

        for (let i = 0; i < fixtures.length; i++) {
            let { point, expectedLabels } = fixtures[i];

            let actual = await service.onCompletition({
                textDocument: { uri: documentUri },
                position: Position.create(point[0], point[1]),
            });

            let actualLabels = actual.items.map(row => row.label);

            for (let label of expectedLabels) {
                assert.ok(actualLabels.indexOf(label) >= 0, `could not find label '${label}' in result of fixture ${i}`);
            }
        }
    });

    it(`should support hover for value of attribute 'class' of @Embedded`, async function () {
        let service = await getService();

        let fixtures: { point: [string, number, number], pieces: string[] }[] = [
            { point: ['/src/Entity2/D1.php', 30, 28], pieces: ['Summary of Embed1'] },
            { point: ['/src/Entity/Embed1.php', 30, 34], pieces: ['Summary of Embed2'] },
        ];

        for (let { point, pieces } of fixtures) {
            let actual: any = await service.onHover({
                textDocument: { uri: projectUri + point[0] },
                position: Position.create(point[1], point[2]),
            });

            for (let piece of pieces) {
                assert.ok(actual.contents.value.indexOf(piece) >= 0);
            }
        }
    });

    it(`should support definition for value of attribute 'class' of @Embedded`, async function () {
        let service = await getService();

        let actual = await service.onDefinition({
            textDocument: { uri: projectUri + '/src/Entity/Embed1.php'},
            position: Position.create(30, 34),
        });

        let expected: Definition = {
            uri: projectUri + '/src/Entity/Embed2.php',
            range: Range.create(13, 0, 13, 0),
        };

        assert.deepEqual(actual, expected);
    });
});
