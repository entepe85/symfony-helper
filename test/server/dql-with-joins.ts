import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position, Definition, Range, Hover, MarkupKind } from 'vscode-languageserver';

describe('tests for dql with joins', function () {
    let documentUri = projectUri + '/src/Controller/DQL7Controller.php';

    it('definition should work', async function () {
        let service = await getService();

        let fixtures: { from: [number, number], to: [number, number, string] }[] = [
            // join columns
            { from: [13, 109], to: [29, 4, 'Car.php'] },
            { from: [13, 134], to: [29, 43, 'Person.php'] },
            // fields of joined entities
            { from: [13, 49], to: [22, 4, 'Person.php'] },
            { from: [13, 65], to: [22, 4, 'City.php'] },
        ];

        for (let { from, to } of fixtures) {
            let actual = await service.onDefinition({
                textDocument: { uri: documentUri },
                position: Position.create(from[0], from[1]),
            });

            let expected: Definition = {
                uri: projectUri + '/src/Entity/Joins/' + to[2],
                range: Range.create(to[0], to[1], to[0], to[1]),
            };

            assert.deepEqual(actual, expected);
        }
    });

    it('completion should work', async function () {
        let service = await getService();

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(13, 136),
        });

        // for join column

        let actualCityCompletion = actual.items.filter(row => row.label === 'city')[0];

        assert.equal(actualCityCompletion.label, 'city');

        assert.deepEqual(actualCityCompletion.textEdit, {
            range: Range.create(13, 134, 13, 136),
            newText: 'city',
        });

        assert.equal(actualCityCompletion.detail, 'App\\Entity\\Joins\\City');

        // for joined entity

        let actualLabels = actual.items.map(row => row.label);
        let expectedLabels = ['id', 'firstName', 'city'];
        for (let label of expectedLabels) {
            assert.ok(actualLabels.indexOf(label) >= 0);
        }
    });

    it('hover should work for join fields', async function () {
        let service = await getService();

        let actual = await service.onHover({ textDocument: { uri: documentUri }, position: Position.create(13, 135) });

        let expected: Hover = {
            range: Range.create(13, 134, 13, 138),
            contents: {
                kind: MarkupKind.Markdown,
                value: ['```', 'City.', '@ORM\\ManyToOne(targetEntity="App\\Entity\\Joins\\City")', '```'].join('\n'),
            }
        };

        assert.deepEqual(actual, expected);
    });

    it('hover should work for fields of joined entities', async function () {
        let service = await getService();

        let actual = await service.onHover({ textDocument: { uri: documentUri }, position: Position.create(13, 65) });

        let expected: Hover = {
            range: Range.create(13, 65, 13, 69),
            contents: {
                kind: MarkupKind.Markdown,
                value: ['```', '@ORM\\Column(type="string", length=255)', '```'].join('\n'),
            }
        };

        assert.deepEqual(actual, expected);
    });

    it(`should work for joins with 'with'`, async function () {
        let service = await getService();

        let fixtures: { from: [number, number], to: [number, number] }[] = [
            { from: [14, 54], to: [9, 0] },
            { from: [14, 74], to: [16, 4] },
            { from: [14, 89], to: [21, 4] },
        ];

        for (let i = 0; i < fixtures.length; i++) {
            let { from, to } = fixtures[i];

            let actual = await service.onDefinition({
                textDocument: { uri: projectUri + '/src/Controller/DQL16Controller.php' },
                position: Position.create(from[0], from[1]),
            });

            let expected: Definition = {
                uri: projectUri + '/src/Entity/E8.php',
                range: Range.create(to[0], to[1], to[0], to[1]),
            };

            assert.deepEqual(actual, expected, `fixture ${i} failed`);
        }
    });
});
