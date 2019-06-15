import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { FoldingRangeKind } from 'vscode-languageserver';

describe('folding ranges in templates', function () {
    it('should work', async function () {
        let service = await getService();

        let documentUri = projectUri + '/templates/fixture-13.html.twig';

        let fixtures = [
            [2, 18], // {% block body %}
            [6, 16], // cycle on products
            [7, 8], // if + endif
            [11, 12], [13, 15], // if + else + endif
            [27, 28], // autoescape
            [31, 32], // embed
            [35, 36], // filter
            [39, 40], // sandbox
            [43, 44], // macro
            [47, 48], // spaceless
        ];

        let commentFixtures = [
            [23, 24],
        ];

        let ranges = await service.onFoldingRanges({textDocument: { uri: documentUri }});

        let rangesCompressed = ranges.map((range) => JSON.stringify(range));

        for (let i = 0; i < fixtures.length; i++) {
            let [startLine, endLine] = fixtures[i];
            assert.ok(rangesCompressed.indexOf(JSON.stringify({startLine, endLine})) >= 0, `fixture ${i} failed`);
        }

        for (let i = 0; i < commentFixtures.length; i++) {
            let [startLine, endLine] = commentFixtures[i];
            assert.ok(rangesCompressed.indexOf(JSON.stringify({startLine, endLine, kind: FoldingRangeKind.Comment})) >= 0, `comment fixture ${i} failed`);
        }
    });

    it('should ignore shortcut block', async function () {
        let service = await getService();

        let documentUri = projectUri + '/templates/fixture-14.html.twig';

        let ranges = await service.onFoldingRanges({ textDocument: { uri: documentUri } });

        assert.ok(ranges.length === 0);
    });

    it('should work for \'for\' with \'else\'', async function () {
        let service = await getService();

        let documentUri = projectUri + '/templates/fixture-15.html.twig';

        let ranges = await service.onFoldingRanges({ textDocument: { uri: documentUri } });

        let rangesCompressed = ranges.map((range) => JSON.stringify(range));

        let expectedRangeA = { startLine: 4, endLine: 5 };
        let expectedRangeB = { startLine: 6, endLine: 7 };

        assert.ok(rangesCompressed.indexOf(JSON.stringify(expectedRangeA)) >= 0);
        assert.ok(rangesCompressed.indexOf(JSON.stringify(expectedRangeB)) >= 0);
    });

    it('should work for \'if\' with \'elseif\'', async function () {
        let fixtures = [
            [5, 6],
            [7, 8],
            [9, 10],
            [11, 12],
            [16, 17],
            [18, 19],
        ];

        let service = await getService();

        let documentUri = projectUri + '/templates/fixture-16.html.twig';

        let ranges = await service.onFoldingRanges({ textDocument: { uri: documentUri } });

        let rangesCompressed = ranges.map((range) => JSON.stringify(range));

        for (let [startLine, endLine] of fixtures) {
            assert.ok(rangesCompressed.indexOf(JSON.stringify({ startLine, endLine })) >= 0);
        }
    });
});
