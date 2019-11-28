import * as assert from 'assert';
import { projectUri, getService } from './_utils';

describe('toggle twig comment', function () {
    it('should comment', async function () {
        let service = await getService();

        let result = await service.commandToggleTwigComment({
            uri: projectUri + '/templates/template-51.twig',
            start: { line: 8, character: 10 },
            end: { line: 8, character: 14 },
        });

        let actualInsertions = JSON.parse(result.message).insertions;

        let expectedInsertions = [
            { value: '{# ', position: { line: 8, character: 10 } },
            { value: ' #}', position: { line: 8, character: 14 } },
        ];

        assert.deepStrictEqual(actualInsertions, expectedInsertions);
    });

    it('should uncomment', async function () {
        let service = await getService();

        let result = await service.commandToggleTwigComment({
            uri: projectUri + '/templates/template-51.twig',
            start: { line: 4, character: 0 },
            end: { line: 4, character: 0 },
        });

        let actualDeletions = JSON.parse(result.message).deletions;

        let expectedDeletions = [
            { start: { line: 5, character: 0 }, end: { line: 5, character: 2 } },
            { start: { line: 2, character: 0 }, end: { line: 2, character: 2 } },
        ];

        assert.deepStrictEqual(actualDeletions, expectedDeletions);
    });
});
