import * as assert from 'assert';
import { projectUri, getService } from './_utils';

describe('new template', function () {
    it('should be in some folder', async function () {
        let service = await getService();

        let fixtures = [
            { input: '/templates/folder/template.twig', output: 'templates/folder/' },
            { input: '/vendor/company/bundle/folder/template.twig', output: 'templates/' },
        ];

        for (let i = 0; i < fixtures.length; i++) {
            let { input, output } = fixtures[i];
            let result = service.getNewTemplateFolder({ baseTemplateUri: projectUri + input });
            assert.equal(result.message, output, `fixture ${i} failed`);
        }
    });
});
