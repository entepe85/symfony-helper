import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position, Definition, Range } from 'vscode-languageserver';

describe(`'repositoryClass' of 'Doctrine\\ORM\\Mapping\\Entity' annotation`, function () {
    {
        let fixtures: { from: [number, number], to: boolean }[] = [
            { from: [7, 31], to: false },
            { from: [7, 32], to: true },
            { from: [7, 59], to: true },
            { from: [7, 60], to: false },
        ];

        for (let i = 0; i < fixtures.length; i++) {
            it(`should support definition (test ${i+1})`, async function () {
                let { from, to } = fixtures[i];

                let service = await getService();

                let actual = await service.onDefinition({
                    textDocument: { uri: projectUri + '/src/Entity/E1.php' },
                    position: Position.create(from[0], from[1]),
                });

                let expected: Definition | null = null;
                if (to !== false) {
                    expected = {
                        uri: projectUri + '/src/Repository/E1Repository.php',
                        range: Range.create(18, 0, 18, 0),
                    };
                }

                assert.deepEqual(actual, expected);
            });
        }
    }

    it('should support hover', async function () {
        let service = await getService();

        let actual = await service.onHover({
            textDocument: { uri: projectUri + '/src/Entity/E1.php'},
            position: Position.create(7, 32),
        }) as any;

        let actualMarkdown: string = actual.contents.value;

        assert.ok(actualMarkdown.includes('Summary of E1Repository.'));
    });
});
