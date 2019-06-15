import * as assert from 'assert';
import { findTwigGlobalsInYaml } from '../../src/project';

describe('twig globals parser', function () {
    it('should work', function () {
        let code = 'twig: { globals: { a: 10, b: "x" }}';
        let actual = findTwigGlobalsInYaml(code);
        let expected = [{ name: 'a', offset: 19, value: '10' }, { name: 'b', offset: 26, value: '"x"' }];
        assert.deepEqual(actual, expected);
    });

    it('should work 2', function () {
        let code = `twig:
    t: t
    globals:
        a: 10
        b: "x"
    t2: t2
`;
        let actual = findTwigGlobalsInYaml(code);
        let expected = [{ name: 'a', offset: 36, value: '10' }, { name: 'b', offset: 50, value: '"x"' }];
        assert.deepEqual(actual, expected);
    });
});
