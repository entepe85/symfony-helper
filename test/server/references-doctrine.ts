import * as assert from 'assert';
import * as _ from 'lodash';
import { projectUri, getService } from './_utils';
import { Position, Range } from 'vscode-languageserver';

describe('references for doctrine', function () {
    let e6Uri = projectUri + '/src/Entity/E6.php';
    let e7Uri = projectUri + '/src/Entity/E7.php';
    let e8Uri = projectUri + '/src/Entity/E8.php';
    let embed2Uri = projectUri + '/src/Entity/Embed2.php';
    let controllerUri = projectUri + '/src/Controller/DQL15Controller.php';

    let expectedE6Locations = [
        { uri: e6Uri, range: Range.create(9, 6, 9, 8) },
        { uri: controllerUri, range: Range.create(15, 17, 15, 30) },
    ];

    let expectedE8Locations = [
        { uri: e8Uri, range: Range.create(9, 6, 9, 8) },
        { uri: controllerUri, range: Range.create(17, 60, 17, 66) },
    ];

    let expectedE7Embed2Locations = [
        { uri: e7Uri, range: Range.create(21, 12, 21, 19) },
        { uri: controllerUri, range: Range.create(17, 21, 17, 27) },
    ];

    let expectedEmbed2NumLocations = [
        { uri: embed2Uri, range: Range.create(20, 12, 20, 17) },
        { uri: controllerUri, range: Range.create(17, 28, 17, 32) },
    ];

    let expectedE8NumLocations = [
        { uri: e8Uri, range: Range.create(21, 12, 21, 16) },
        { uri: projectUri + '/templates/fixture-46.html.twig', range: Range.create(1, 12, 1, 15) },
    ];

    it('should support requests from classname in entity file', async function () {
        let service = await getService();

        let actual = await service.onReferences({
            textDocument: { uri: e6Uri },
            position: Position.create(9, 6),
            context: { includeDeclaration: true },
        });

        for (let i = 0; i < expectedE6Locations.length; i++) {
            let row = expectedE6Locations[i];
            let isFound = actual.find(a => _.isEqual(a, row)) !== undefined;
            assert.ok(isFound, `expected ${i} failed`);
        }
    });

    it('should support requests from classname in dql string', async function () {
        let service = await getService();

        let actual = await service.onReferences({
            textDocument: { uri: controllerUri },
            position: Position.create(15, 30),
            context: { includeDeclaration: true },
        });

        for (let i = 0; i < expectedE6Locations.length; i++) {
            let row = expectedE6Locations[i];
            let isFound = actual.find(a => _.isEqual(a, row)) !== undefined;
            assert.ok(isFound, `expected ${i} failed`);
        }
    });

    it('should support requests from alias in dql string', async function () {
        let service = await getService();

        let actual = await service.onReferences({
            textDocument: { uri: controllerUri },
            position: Position.create(17, 60),
            context: { includeDeclaration: true },
        });

        for (let i = 0; i < expectedE8Locations.length; i++) {
            let row = expectedE8Locations[i];
            let isFound = actual.find(a => _.isEqual(a, row)) !== undefined;
            assert.ok(isFound, `expected ${i} failed`);
        }
    });

    it('should support requests from fieldname in entity file', async function () {
        let service = await getService();

        let actual = await service.onReferences({
            textDocument: { uri: e7Uri },
            position: Position.create(21, 12),
            context: { includeDeclaration: true },
        });

        for (let i = 0; i < expectedE7Embed2Locations.length; i++) {
            let row = expectedE7Embed2Locations[i];
            let isFound = actual.find(a => _.isEqual(a, row)) !== undefined;
            assert.ok(isFound, `expected ${i} failed`);
        }
    });

    it('should support requests from fieldname in dql string', async function () {
        let service = await getService();

        let actual = await service.onReferences({
            textDocument: { uri: controllerUri },
            position: Position.create(17, 32),
            context: { includeDeclaration: true },
        });

        for (let i = 0; i < expectedEmbed2NumLocations.length; i++) {
            let row = expectedEmbed2NumLocations[i];
            let isFound = actual.find(a => _.isEqual(a, row)) !== undefined;
            assert.ok(isFound, `expected ${i} failed`);
        }
    });

    it('should support search in twig', async function () {
        let service = await getService();

        let actual = await service.onReferences({
            textDocument: { uri: e8Uri },
            position: Position.create(21, 12),
            context: { includeDeclaration: true },
        });

        for (let i = 0; i < expectedE8NumLocations.length; i++) {
            let row = expectedE8NumLocations[i];
            let isFound = actual.find(a => _.isEqual(a, row)) !== undefined;
            assert.ok(isFound, `expected ${i} failed`);
        }
    });

    it('should support search from twig', async function () {
        let service = await getService();

        let actual = await service.onReferences({
            textDocument: { uri: projectUri + '/templates/fixture-46.html.twig' },
            position: Position.create(1, 12),
            context: { includeDeclaration: true },
        });

        for (let i = 0; i < expectedE8NumLocations.length; i++) {
            let row = expectedE8NumLocations[i];
            let isFound = actual.find(a => _.isEqual(a, row)) !== undefined;
            assert.ok(isFound, `expected ${i} failed`);
        }
    });
});
