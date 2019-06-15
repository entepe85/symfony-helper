import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position, Definition, Range } from 'vscode-languageserver';

describe('jump to service definition from \'something\' in xml file', function () {
    it('from \'alias\' in <service>', async function () {
        let service = await getService();

        let documentUri = projectUri + '/vendor/symfony/security-bundle/Resources/config/security.xml';

        let fixtures = [
            [21, 105],
            [21, 135]
        ];

        for (let [line, character] of fixtures) {
            let actual = await service.onDefinition({
                textDocument: { uri: documentUri },
                position: Position.create(line, character),
            });

            let expected: Definition = {
                uri: documentUri,
                range: Range.create(15, 8, 15, 8),
            };

            assert.deepEqual(actual, expected);
        }
    });

    it('from \'id\' in <argument type="service">', async function () {
        let service = await getService();

        let documentUri = projectUri + '/vendor/symfony/security-bundle/Resources/config/security.xml';

        {
            let fixtures = [
                [18, 41],
                [18, 73],
            ];

            for (let [line, character] of fixtures) {
                let actual = await service.onDefinition({
                    textDocument: { uri: documentUri },
                    position: Position.create(line, character),
                });

                let expected: Definition = {
                    uri: documentUri,
                    range: Range.create(91, 8, 91, 8),
                };

                assert.deepEqual(actual, expected);
            }
        }

        {
            let missFixtures = [
                [18, 40],
                [18, 74],
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
});
