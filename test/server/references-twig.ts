import * as assert from 'assert';
import * as util from 'util';
import { projectUri, getService } from './_utils';
import { Position, Location, Range } from 'vscode-languageserver';

describe('references for twig', function () {
    let documentUri = projectUri + '/templates/fixture-38.html.twig';

    let expectedFunctionLocations = [
        { uri: projectUri + '/src/Twig/OneForAll.php', range: Range.create(12, 33, 12, 44) },
        { uri: documentUri, range: Range.create(4, 32, 4, 41) },
        { uri: projectUri + '/templates/fixture-24.html.twig', range: Range.create(5, 7, 5, 16) },
    ];

    let expectedTestLocations = [
        { uri: projectUri + '/vendor/twig/twig/lib/Twig/Extension/Core.php', range: Range.create(210, 26, 210, 36) },
        { uri: documentUri, range: Range.create(6, 10, 6, 18) },
        { uri: documentUri, range: Range.create(7, 10, 7, 18) },
    ];

    it('should support requests from user-defined templates for user-defined functions', async function () {
        let service = await getService();

        let actual = await service.onReferences({
            textDocument: { uri: documentUri },
            position: Position.create(4, 32),
            context: { includeDeclaration: true },
        });

        for (let i = 0; i < expectedFunctionLocations.length; i++) {
            let row = expectedFunctionLocations[i];
            let isFound = actual.find(a => util.isDeepStrictEqual(a, row)) !== undefined;
            assert.ok(isFound, `expected ${i} failed`);
        }

        // don't include tests and filters with the same name
        let thisFileReferencesCount = actual.filter(row => row.uri === documentUri).length;
        assert.equal(thisFileReferencesCount, 1);
    });

    it('should support requests from user-defined templates for user-defined filters', async function () {
        let service = await getService();

        let actual = await service.onReferences({
            textDocument: { uri: documentUri },
            position: Position.create(4, 73),
            context: { includeDeclaration: true },
        });

        let expectedLocations: Location[] = [
            { uri: projectUri + '/src/Twig/OneForAll.php', range: Range.create(22, 31, 22, 42) }, // definition
            { uri: documentUri, range: Range.create(4, 73, 4, 82) }, // this document
            { uri: documentUri, range: Range.create(9, 10, 9, 19) }, // this document
            { uri: projectUri + '/templates/fixture-24.html.twig', range: Range.create(7, 17, 7, 26) },
        ];

        for (let i = 0; i < expectedLocations.length; i++) {
            let row = expectedLocations[i];
            let isFound = actual.find(a => util.isDeepStrictEqual(a, row)) !== undefined;
            assert.ok(isFound, `expected ${i} failed`);
        }
    });

    // test for vendor and tests
    it('should support requests from user-defined templates for vendor-defined tests', async function () {
        let service = await getService();

        let actual = await service.onReferences({
            textDocument: { uri: documentUri },
            position: Position.create(6, 10),
            context: { includeDeclaration: true },
        });

        for (let i = 0; i < expectedTestLocations.length; i++) {
            let row = expectedTestLocations[i];
            let isFound = actual.find(a => util.isDeepStrictEqual(a, row)) !== undefined;
            assert.ok(isFound, `expected ${i} failed`);
        }
    });

    it('should support requests from definitions of user-defined functions', async function () {
        let service = await getService();

        let actual = await service.onReferences({
            textDocument: { uri: projectUri + '/src/Twig/OneForAll.php' },
            position: Position.create(12, 34),
            context: { includeDeclaration: true },
        });

        for (let i = 0; i < expectedFunctionLocations.length; i++) {
            let row = expectedFunctionLocations[i];
            let isFound = actual.find(a => util.isDeepStrictEqual(a, row)) !== undefined;
            assert.ok(isFound, `expected ${i} failed`);
        }
    });

    it('should support requests from definitions of vendor-defined tests', async function () {
        let service = await getService();

        let actual = await service.onReferences({
            textDocument: { uri: projectUri + '/vendor/twig/twig/lib/Twig/Extension/Core.php' },
            position: Position.create(210, 27),
            context: { includeDeclaration: true },
        });

        for (let i = 0; i < expectedTestLocations.length; i++) {
            let row = expectedTestLocations[i];
            let isFound = actual.find(a => util.isDeepStrictEqual(a, row)) !== undefined;
            assert.ok(isFound, `expected ${i} failed`);
        }
    });
});
