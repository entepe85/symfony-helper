import * as assert from 'assert';
import { projectUri, getService } from './_utils';

describe('open compiled template', function () {
    it('should work', async function () {
        let service = await getService();

        let result = await service.commandOpenCompiledTemplate({ uri: projectUri + '/templates/base.html.twig'});
        assert.ok(result.success);

        let result2 = await service.commandOpenCompiledTemplate({ uri: projectUri + '/templates/default/not-existing-template.html.twig'});
        assert.ok(!result2.success);
    });
});
