import * as assert from 'assert';
import { parsePhpDocBlock, PhpDocBlockTag } from '../../src/utils';

describe('parser of php DocBlocks', function () {
    it('should find summary of one line comment', function () {
        let text = '/** summary */';
        let actual = parsePhpDocBlock(text);
        assert.equal(actual!.summary, 'summary');
    });

    it('should find @var of one line comment', function () {
        let text = '/** @var string[]|null */';
        let actual = parsePhpDocBlock(text);

        assert.deepEqual(actual!.tags[0], { type: 'var', typeString: 'string[]|null'});
    });

    {
        let fixtures = [
            {
                text: '/**summary\n\ndescription*/',
                summary: 'summary',
            },
            {
                text: '/**\nsummary2\n\ndescription*/',
                summary: 'summary2',
            },
            {
                text: '/**\n\n\nsummary3\nsummary3 line2\n\ndescription*/',
                summary: 'summary3\nsummary3 line2',
            },
            {
                text: '/**\n * summary4\n * summary4 line2\n * \ndescription\n */', // I forgot '*' in previous tests
                summary: 'summary4\nsummary4 line2',
            },
            {
                text: '/**\n * summary5\n *\n * \n@return string\n */',
                summary: 'summary5',
            },
        ];

        for (let i = 0; i < fixtures.length; i++) {
            it(`should find summary in different positions and of different sizes (test ${i+1})`, function () {
                let { text, summary } = fixtures[i];

                let actual = parsePhpDocBlock(text);
                assert.equal(actual!.summary, summary);
            });
        }
    }

    it('should find description', function () {
        let text = `/**
 * summary
 *
 *
 * line 1
 *
 * line 2
 * line 3
 *
 *
 * line 4
 *
 *
 * @return string
 */`;

        let expectedDescription = `line 1

line 2
line 3


line 4`;

        let actual = parsePhpDocBlock(text);

        assert.equal(actual!.description, expectedDescription);
    });

    it('should parse tags', function () {
let text = `/**
 * summary
 *
 * @param\t\tint\t\t$number
 *
 * @param
 * @param    \\DateTime    $date
 *
 * @return string[]
*/`;

        let actual = parsePhpDocBlock(text);

        let expectedTags: PhpDocBlockTag[] = [
            {
                type: 'param',
                typeString: 'int',
                paramName: 'number',
            },
            {
                type: 'param',
                typeString: '\\DateTime',
                paramName: 'date',
            },
            {
                type: 'return',
                typeString: 'string[]',
            }
        ];

        assert.deepEqual(actual!.tags, expectedTags);
    });
});
