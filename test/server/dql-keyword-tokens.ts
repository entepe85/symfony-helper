import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position, Definition, Range } from 'vscode-languageserver';

describe('support keyword tokens in dql', function () {
    let documentUri = projectUri + '/src/Controller/DQL8Controller.php';

    it('autocomplete', async function () {
        let service = await getService();

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(14, 29),
        });

        let actualLabels = actual.items.map(row => row.label);

        let expectedLabels = ['count', 'sum'];

        for (let label of expectedLabels) {
            assert.ok(actualLabels.indexOf(label) >= 0);
        }
    });

    it('definition', async function () {
        let service = await getService();

        let actual = await service.onDefinition({
            textDocument: { uri: documentUri },
            position: Position.create(14, 29),
        });

        let expected: Definition = {
            uri: projectUri + '/src/Entity/Joins/Car.php',
            range: Range.create(35, 4, 35, 4),
        };

        assert.deepEqual(actual, expected);
    });

    it('autocomplete for joined entity', async function () {
        let service = await getService();

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(14, 36),
        });

        let actualLabels = actual.items.map(row => row.label);

        let expectedLabels = ['firstName'];

        for (let label of expectedLabels) {
            assert.ok(actualLabels.indexOf(label) >= 0);
        }
    });

    it('definition for joined entity', async function () {
        let service = await getService();

        let actual = await service.onDefinition({
            textDocument: { uri: documentUri },
            position: Position.create(14, 36),
        });

        let expected: Definition = {
            uri: projectUri + '/src/Entity/Joins/Person.php',
            range: Range.create(22, 4, 22, 4),
        };

        assert.deepEqual(actual, expected);
    });
});
