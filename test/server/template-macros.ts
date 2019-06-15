import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position, Location, Range, Hover, MarkupContent } from 'vscode-languageserver';

describe('template macros', function () {
    let documentUri = projectUri + '/templates/fixture-39.html.twig';

    it('should support jump to file of macro definitions', async function () {
        let service = await getService();

        let fixtures = [
            // from {%import%}
            { from: [2, 11], to: 'form-helpers.twig' },
            { from: [3, 26], to: 'form-helpers.twig' },
            { from: [7, 30], to: 'form-helpers-2.twig' },
            { from: [8, 9], to: 'form-helpers-2.twig' },

            // from alias defined in {%import%}
            { from: [10, 3], to: 'form-helpers.twig'},
            { from: [10, 14], to: 'form-helpers.twig'},
            { from: [11, 3], to: 'form-helpers-2.twig'},
            { from: [11, 15], to: 'form-helpers-2.twig'},
        ];

        for (let { from, to } of fixtures) {
            let actual = await service.onDefinition({
                textDocument: { uri: documentUri },
                position: Position.create(from[0], from[1]),
            });

            let expected: Location = {
                uri: projectUri + '/templates/' + to,
                range: Range.create(0, 0, 0, 0),
            };

            assert.deepEqual(actual, expected);
        }
    });

    it('should support completion of filenames with macro definitions in {%import%} and {%from%}', async function () {
        let service = await getService();

        let fixtures = [
            [2, 14],
            [8, 28],
        ];

        let expectedLabels = ['form-helpers.twig', 'form-helpers-2.twig'];
        let unexpectedLabels = ['base.html.twig', '_part.html.twig'];

        for (let row of fixtures) {
            let actual = await service.onCompletition({
                textDocument: { uri: documentUri },
                position: Position.create(row[0], row[1]),
            });

            let actualLabels = actual.items.map(row => row.label);

            for (let label of expectedLabels) {
                assert.ok(actualLabels.indexOf(label) >= 0);
            }

            for (let label of unexpectedLabels) {
                assert.ok(actualLabels.indexOf(label) < 0);
            }
        }
    });

    it('should support jump to macro definition from {%from%}', async function () {
        let service = await getService();

        let fixtures: { from: [number, number], to: false | [number, number]}[] = [
            { from: [8, 37], to: [4, 9] },
            { from: [8, 43], to: [4, 9] },
            { from: [8, 44], to: false },
            { from: [8, 45], to: [8, 9] },
            { from: [8, 53], to: false },
            { from: [8, 58], to: false },
            { from: [8, 63], to: [17, 9] },
        ];

        for (let i = 0; i < fixtures.length; i++) {
            let { from, to } = fixtures[i];

            let actual = await service.onDefinition({
                textDocument: { uri: documentUri },
                position: Position.create(from[0], from[1]),
            });

            let expected: Location | null = null;
            if (to !== false) {
                expected = {
                    uri: projectUri + '/templates/form-helpers-2.twig',
                    range: Range.create(to[0], to[1], to[0], to[1]),
                };
            }

            assert.deepEqual(actual, expected, `failed fixture ${i}`);
        }
    });

    it('should support hover over macro import in {%from%}', async function () {
        let service = await getService();

        let actual = await service.onHover({
            textDocument: { uri: documentUri },
            position: Position.create(8, 63),
        }) as Hover;

        assert.ok((actual.contents as MarkupContent).value.includes('Summary of blockE'));
        assert.ok((actual.contents as MarkupContent).value.includes(`macro blockE(content = 'block-e')`));
    });

    it('should support completion of imports in {%from%}', async function () {
        let service = await getService();

        let fixtures = [
            { point: [8, 36], result: false },
            { point: [8, 37], result: true },
            { point: [8, 43], result: true },
            { point: [8, 44], result: true },
            { point: [8, 45], result: true },
            { point: [8, 51], result: true },
            { point: [8, 52], result: false },
            { point: [8, 53], result: false },
            { point: [8, 55], result: false },
            { point: [8, 56], result: false },
        ];

        let expectedLabels = ['blockA', 'blockC'];
        let unexpectedLabels = ['blockB', 'oneForAll', 'app', 'globalA', 'constant'];

        for (let i = 0; i < fixtures.length; i++) {
            let { point, result } = fixtures[i];

            let actual = await service.onCompletition({
                textDocument: { uri: documentUri },
                position: Position.create(point[0], point[1]),
            });

            let actualLabels = actual.items.map(row => row.label);

            if (result) {
                for (let label of expectedLabels) {
                    assert.ok(actualLabels.indexOf(label) >= 0, `not found label '${label}' in fixture ${i}`);
                }

                for (let label of unexpectedLabels) {
                    assert.ok(actualLabels.indexOf(label) < 0, `unexpected label '${label}' in fixture ${i}`);
                }
            } else {
                assert.equal(actual.items.length, 0, `should be no items in fixture ${i}`);
            }
        }
    });

    it('should support hover over alias defined in {%import%}', async function () {
        let service = await getService();

        let actual = await service.onHover({
            textDocument: { uri: documentUri },
            position: Position.create(11, 3),
        }) as Hover;

        assert.ok((actual.contents as MarkupContent).value.includes(`macro collection 'form-helpers-2.twig'`));
    });

    it('should support completion of aliases defined it {%import%}', async function () {
        let service = await getService();

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(10, 3),
        });

        let actualLabels = actual.items.map(row => row.label);

        let expectedLabels = ['formHelpers', 'formHelpers2'];

        for (let label of expectedLabels) {
            assert.ok(actualLabels.indexOf(label) >= 0);
        }
    });

    it('should support definition for macro call', async function () {
        let service = await getService();

        let fixtures: { from: [number, number], to: [string, number, number]}[] = [
            { from: [10, 15], to: ['form-helpers.twig', 0, 9]},
            { from: [10, 21], to: ['form-helpers.twig', 0, 9]},
            { from: [11, 16], to: ['form-helpers-2.twig', 0, 9]},
            { from: [12, 3], to: ['form-helpers.twig', 4, 9]},
            { from: [13, 3], to: ['form-helpers-2.twig', 8, 9]},
        ];

        for (let i = 0; i < fixtures.length; i++) {
            let { from, to } = fixtures[i];

            let actual = await service.onDefinition({
                textDocument: { uri: documentUri },
                position: Position.create(from[0], from[1]),
            });

            let expected: Location = {
                uri: projectUri + '/templates/' + to[0],
                range: Range.create(to[1], to[2], to[1], to[2]),
            };

            assert.deepEqual(actual, expected, `failed fixture ${i}`);
        }
    });

    it('should support hover for macro call', async function () {
        let service = await getService();

        {
            let actual = await service.onHover({
                textDocument: { uri: documentUri },
                position: Position.create(10, 15),
            }) as Hover;

            assert.ok((actual.contents as MarkupContent).value.includes(`macro blockA(content = 'block-a')`));
        }

        {
            let actual = await service.onHover({
                textDocument: { uri: documentUri },
                position: Position.create(13, 3),
            }) as Hover;

            assert.ok((actual.contents as MarkupContent).value.includes(`macro blockD(content = 'block-d')`));
        }
    });

    it(`should not complete after 'as' in {%import%}`, async function () {
        let service = await getService();

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(2, 33),
        });

        assert.equal(actual.items.length, 0);
    });

    it('should complete macro calls after alias of macro collection', async function () {
        let service = await getService();

        let fixtures = [
            [10, 15],
            [10, 18],
        ];

        let expectedLabels = ['blockA', 'blockB'];
        let unexpectedLabels = ['blockC', 'app', 'oneForAll'];

        for (let [line, character] of fixtures) {
            let actual = await service.onCompletition({
                textDocument: { uri: documentUri },
                position: Position.create(line, character),
            });

            let actualLabels = actual.items.map(row => row.label);

            for (let label of expectedLabels) {
                assert.ok(actualLabels.indexOf(label) >= 0);
            }

            for (let label of unexpectedLabels) {
                assert.ok(actualLabels.indexOf(label) < 0);
            }
        }
    });

    it('should complete standalone macro calls', async function () {
        let service = await getService();

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(12, 3),
        });

        let actualLabels = actual.items.map(row => row.label);

        let expectedLabels = ['blockB', 'blockC', 'blockX'];
        let unexpectedLabels = ['blockD'];

        for (let label of expectedLabels) {
            assert.ok(actualLabels.indexOf(label) >= 0);
        }

        for (let label of unexpectedLabels) {
            assert.ok(actualLabels.indexOf(label) < 0);
        }
    });

    it('should support completion of arguments inside of macro body', async function () {
        let service = await getService();

        let actual = await service.onCompletition({
            textDocument: { uri: projectUri + '/templates/form-helpers.twig' },
            position: Position.create(12, 7),
        });

        let actualLabels = actual.items.map(row => row.label);

        assert.ok(actualLabels.indexOf('paramE1') >= 0);
    });
});
