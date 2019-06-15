import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position, Hover, Range, MarkupKind } from 'vscode-languageserver';

describe('hover service name in get() call in AbstractController', function () {
    it('should work', async function () {
        let service = await getService();

        let documentUri = projectUri + '/src/Controller/TController.php';

        let actual = await service.onHover({
            textDocument: { uri: documentUri },
            position: Position.create(13, 20),
        });

        let expected: Hover = {
            range: Range.create(13, 19, 13, 51),
            contents: {
                kind: MarkupKind.Markdown,
                value: [
                    '```',
                    'class Symfony\\Component\\Security\\Core\\Authorization\\AuthorizationChecker',
                    'defined in vendor/symfony/security-bundle/Resources/config/security.xml',
                    '```'
                ].join('\n'),
            },
        };

        assert.deepEqual(actual, expected);
    });
});
