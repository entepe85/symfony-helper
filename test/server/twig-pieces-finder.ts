import * as assert from 'assert';
import { tokenize, findTwigPieces } from '../../src/twig';

describe('twig lexer', function () {
    it('should work', function () {
        let text = `{% for p of products %}
    {# comment #}
    <p>{{ p.price }} {{ p.name </p>
{% endif
{# comment
`;
        let tokens = tokenize(text);
        let pieces = findTwigPieces(tokens);
        let piecesTypes = pieces.map(row => row.type);
        assert.deepEqual(piecesTypes, ['block', 'comment', 'var', 'var', 'block', 'comment']);
    });
});
