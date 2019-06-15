import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position, Hover, Range, MarkupKind } from 'vscode-languageserver';

describe('hover service name in \'something\' in xml file', function () {
    it('\'alias\' in <service>', async function () {
        let service = await getService();

        let documentUri = projectUri + '/vendor/symfony/security-bundle/Resources/config/security.xml';

        let fixtures = [
            [21, 105],
            [21, 135]
        ];

        for (let [line, character] of fixtures) {
            let actual = await service.onHover({
                textDocument: { uri: documentUri },
                position: Position.create(line, character),
            });

            let expected: Hover = {
                range: Range.create(21, 105, 21, 135),
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
        }
    });

    it('\'id\' in <argument type="service">', async function () {
        let service = await getService();

        let documentUri = projectUri + '/vendor/symfony/security-bundle/Resources/config/security.xml';

        let fixtures = [
            [18, 41],
            [18, 73],
        ];

        for (let [line, character] of fixtures) {
            let actual = await service.onHover({
                textDocument: { uri: documentUri },
                position: Position.create(line, character),
            });

            let expected: Hover = {
                range: Range.create(18, 41, 18, 73),
                contents: {
                    kind: MarkupKind.Markdown,
                    value: [
                        '```',
                        'class Symfony\\Component\\Security\\Core\\Authorization\\AccessDecisionManager',
                        'defined in vendor/symfony/security-bundle/Resources/config/security.xml',
                        '```'
                    ].join('\n'),
                },
            };

            assert.deepEqual(actual, expected);
        }
    });
});
