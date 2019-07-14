import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import * as _ from 'lodash';

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

        assert.equal(actualInsertions.length, 2);

        for (let i = 0; i < expectedInsertions.length; i++) {
            let insertion = expectedInsertions[i];
            let found = actualInsertions.find((v: any) => _.isEqual(v, insertion));
            assert.ok(found !== undefined, `expected insertion ${i} not found`);
        }
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

        assert.equal(actualDeletions.length, 2);

        for (let i = 0; i < expectedDeletions.length; i++) {
            let d = expectedDeletions[i];
            let found = actualDeletions.find((v: any) => _.isEqual(v, d));
            assert.ok(found !== undefined, `expected deletion ${i} not found`);
        }
    });
});
