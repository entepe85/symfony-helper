import * as assert from 'assert';
import * as twig from '../../src/twig';

describe('scope walker', function () {
    let findVariables = async (code: string, offset: number): Promise<twig.ScopeValues> => {
        let tokens = twig.tokenize(code);

        let pieces = twig.findTwigPieces(tokens);

        let stmts = twig.parse(code, tokens, pieces);

        let variables = await twig.findVariables(stmts, pieces, tokens, code, offset, new twig.Scope(), async () => null, () => null) as any;

        return variables;
    };

    it('should support {%set%}', async function () {
        let variables = await findVariables(`{% set xxxx = 12 %}
{{  }}`, 23);

        assert.ok(variables.xxxx !== undefined);
    });

    it('should support {%for%}', async function () {
        let code = `{% for xx in [3,4,5] %}
    {% set yy = xx %}
{% endfor %}
{{  }}`;
        let variablesInBody = await findVariables(code, 40)
        assert.ok(variablesInBody.xx !== undefined);

        let variablesOutsideBody = await findVariables(code, 62);
        assert.ok(variablesOutsideBody.xx === undefined);
        assert.ok(variablesOutsideBody.yy === undefined);
    });
});
