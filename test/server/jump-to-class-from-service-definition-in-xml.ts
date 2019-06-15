import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position, Definition, Range } from 'vscode-languageserver';

describe('jump to class from service definition in xml file', function () {
    it('should work', async function () {
        let service = await getService();

        let documentUri = projectUri + '/vendor/symfony/security-bundle/Resources/config/security.xml';

        {
            let fixtures = [
                [15, 60],
                [15, 126]
            ];

            for (let [line, character] of fixtures) {
                let actual = await service.onDefinition({
                    textDocument: { uri: documentUri },
                    position: Position.create(line, character),
                });

                let expected: Definition = {
                    uri: projectUri + '/vendor/symfony/security-core/Authorization/AuthorizationChecker.php',
                    range: Range.create(25, 0, 25, 0),
                };

                assert.deepEqual(actual, expected);
            }
        }

        {
            // quote touching not counted
            let missFixtures = [
                [15, 59],
                [15, 127]
            ];

            for (let [line, character] of missFixtures) {
                let actual = await service.onDefinition({
                    textDocument: { uri: documentUri },
                    position: Position.create(line, character),
                });

                assert.ok(actual === null);
            }
        }
    });

    // there was a problem with regexps and logic ('file_locator' is a classname too)
    it('should work 2', async function () {
        let service = await getService();

        let documentUri = projectUri + '/vendor/symfony/framework-bundle/Resources/config/services.xml';

        let fixtures = [
            [48, 42],
            [48, 89],
        ];

        for (let [line, character] of fixtures) {
            let actual = await service.onDefinition({
                textDocument: { uri: documentUri },
                position: Position.create(line, character),
            });

            let expected: Definition = {
                uri: projectUri + '/vendor/symfony/http-kernel/Config/FileLocator.php',
                range: Range.create(21, 0, 21, 0),
            };

            assert.deepEqual(actual, expected);
        }
    });

    it('should work on class-like identifiers', async function () {
        let service = await getService();

        let documentUri = projectUri + '/vendor/symfony/security-bundle/Resources/config/security.xml';

        let fixtures = [
            [21, 21],
            [21, 96]
        ];

        for (let [line, character] of fixtures) {
            let actual = await service.onDefinition({
                textDocument: { uri: documentUri },
                position: Position.create(line, character),
            });

            let expected: Definition = {
                uri: projectUri + '/vendor/symfony/security-core/Authorization/AuthorizationCheckerInterface.php',
                range: Range.create(18, 0, 18, 0),
            };

            assert.deepEqual(actual, expected);
        }
    });
});
