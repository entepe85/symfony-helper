import * as assert from 'assert';
import URI from 'vscode-uri';
import { projectUri, project34Uri, getService } from './_utils';

describe('open compiled template', function () {
    it('should work', async function () {
        let service = await getService();

        let fixtures = [
            [projectUri, '/templates/base.html.twig'],
            [projectUri, '/vendor/symfony/web-profiler-bundle/Resources/views/Collector/router.html.twig'],
            [project34Uri, '/app/Resources/views/base.html.twig'],
            [project34Uri, '/vendor/symfony/symfony/src/Symfony/Bundle/TwigBundle/Resources/views/layout.html.twig'],
        ]

        for (let i = 0; i < fixtures.length; i++) {
            let [base, rel] = fixtures[i];

            let result = await service.commandOpenCompiledTemplate({ uri: base + rel });

            assert.ok(result.success, `fixture ${i} is not successfull`);
            assert.ok(
                URI.file(result.message).toString().startsWith(base + '/var/cache/') && result.message.endsWith('.php'),
                `fixture ${i} resulted in unexpected uri`
            );
        }

        let result2 = await service.commandOpenCompiledTemplate({ uri: projectUri + '/templates/default/not-existing-template.html.twig'});
        assert.ok(!result2.success);
    });
});
