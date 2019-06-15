import * as assert from 'assert';
import { parseExpression, tokenize, AccessPathElement } from '../../src/twig';

describe('twig expression parser', function () {
    it('should parse access paths', function () {
        let fixtures = [
            // names and dots only
            { code: '{{ xx }}', expected: [['name']] },
            { code: '{{ xx yy }}', expected: [['name'], ['name']] },
            { code: '{{ xxx. }}', expected: [['name', '.']]},
            { code: '{{ * xx & zz.vv + vv }}', expected: [['name'], ['name', '.', 'name'], ['name']] },
            { code: '{{ xx.zz.dd vv.yy }}', expected: [['name', '.', 'name', '.', 'name'], ['name', '.', 'name']] },
            // with '['
            { code: '{{ xx[ }}', expected: [['name', '[']] },
            { code: '{{ xx[] }}', expected: [['name', '[']] },
            { code: '{{ xx[z] }}', expected: [['name', '['], ['name']] },
            { code: '{{ xx.yy[z.z][z] }}', expected: [['name', '.', 'name', '[', '['], ['name', '.', 'name'], ['name']] },
            { code: '{{ x[i] + y[v.j] }}', expected: [['name', '['], ['name', '['], ['name'], ['name', '.', 'name']] },
            { code: '{{ x[z[v. + w.w]].n }}', expected: [['name', '[', '.', 'name'], ['name', '['], ['name', '.'], ['name', '.', 'name']] },
            // with '('
            { code: '{{ xx( }}', expected: [['name', '(']] },
            { code: '{{ xx() }}', expected: [['name', '(']] },
            { code: '{{ xx(i, k.). }}', expected: [['name', '(', '.'], ['name'], ['name', '.']] },
        ];

        for (let i = 0; i < fixtures.length; i++) {
            let { code, expected } = fixtures[i];

            let tokens = tokenize(code);

            let { accessPaths: actualAccessPaths } = parseExpression(code, tokens, 1, tokens.length - 2);

            let actualAccessPathsTypes = actualAccessPaths.map(row => row.map(subrow => subrow.type));

            assert.deepEqual(actualAccessPathsTypes, expected, `fixture ${i} failed`);
        }
    });

    it('should properly parse calls', function () {
        let fixtures: { code: string, pathIndex: number, elementIndex: number, expectedElement: AccessPathElement }[] = [
            { code: '{{ func(a, z, }}', pathIndex: 0, elementIndex: 1, expectedElement: { type: '(', startTokenIndex: 2, commaTokenIndexes: [4, 6] } },
            { code: '{{ func(z, func2(3, 4)) }}', pathIndex: 0, elementIndex: 1, expectedElement: { type: '(', startTokenIndex: 2, endTokenIndex: 11, commaTokenIndexes: [4] } },
            { code: '{{ func(z, func2(3, 4)) }}', pathIndex: 2, elementIndex: 1, expectedElement: { type: '(', startTokenIndex: 6, endTokenIndex: 10, commaTokenIndexes: [8] } },
        ];

        for (let i = 0; i < fixtures.length; i++) {
            let { code, pathIndex, elementIndex, expectedElement } = fixtures[i];

            let tokens = tokenize(code);

            let { accessPaths: actualAccessPaths } = parseExpression(code, tokens, 1, tokens.length - 2);

            assert.deepEqual(actualAccessPaths[pathIndex][elementIndex], expectedElement, `fixture ${i} failed`);
        }
    });
});
