import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position, Definition, Range } from 'vscode-languageserver';

describe('entities from xml', function () {
    it('should support definition in dql', async function () {
        let service = await getService();

        let fixtures: { from: [number, number], to: [string, number, number] }[] = [
            { from: [16, 18], to: ['Project.orm.xml', 7, 8] },
            { from: [17, 18], to: ['Project.orm.xml', 11, 8] },
            { from: [18, 17], to: ['Project.orm.xml', 6, 4] },
            { from: [19, 29], to: ['Project.orm.xml', 13, 8] },
            { from: [20, 29], to: ['Project.orm.xml', 16, 8] },
            { from: [21, 26], to: ['ProjectUser.orm.xml', 11, 8] },
            { from: [22, 28], to: ['ProjectUser.orm.xml', 11, 8] },
        ];

        for (let i = 0; i < fixtures.length; i++) {
            let { from, to } = fixtures[i];

            let actual = await service.onDefinition({
                textDocument: { uri: projectUri + '/src/Controller/DQL17Controller.php' },
                position: Position.create(from[0], from[1]),
            });

            let expected: Definition = {
                uri: projectUri + '/config/doctrine/' + to[0],
                range: Range.create(to[1], to[2], to[1], to[2]),
            };

            assert.deepEqual(actual, expected, `fixture ${i} failed`);
        }
    });

    it('should support completion in dql', async function () {
        let service = await getService();

        let expectedLabels = ['id', 'name', 'owner', 'testers'];

        let actual = await service.onCompletition({
            textDocument: { uri: projectUri + '/src/Controller/DQL17Controller.php' },
            position: Position.create(16, 18),
        });

        let actualLabels = actual.items.map(row => row.label);

        for (let label of expectedLabels) {
            assert.ok(actualLabels.indexOf(label) >= 0, `label '${label}' not found`);
        }

        let testersLabel = actual.items.find(row => row.label === 'testers');

        assert.ok((testersLabel as any).documentation.value.includes('Project testers'));
    });

    it('should support hover in dql', async function () {
        let service = await getService();

        let fixtures = [
            { point: [17, 18], text: 'Project name' },
            { point: [18, 17], text: 'Summary of App\\Entity3\\Project' },
            { point: [20, 29], text: 'Project testers' },
            { point: [21, 26], text: 'Name of user' },
        ];

        for (let i = 0; i < fixtures.length; i++) {
            let { point, text } = fixtures[i];

            let actual: any = await service.onHover({
                textDocument: { uri: projectUri + '/src/Controller/DQL17Controller.php' },
                position: Position.create(point[0], point[1]),
            });

            assert.ok(actual.contents.value.includes(text), `fixture ${i} failed`);
        }
    });
});
