import * as assert from 'assert';
import * as twig from '../../src/twig';

describe('scope walker', function () {
    let findVariables = async (code: string, offset: number): Promise<twig.ScopeValues> => {
        let parsed = twig.fullParse(code);

        let variables = await twig.findVariables(parsed, offset, new twig.Scope(), async () => null, () => null) as any;

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
