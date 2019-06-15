import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position, Definition, Range } from 'vscode-languageserver';

describe(`'targetEntity' of 'Doctrine\\ORM\\Mapping' annotations`, function () {
    {
        let fixtures: { from: { uri: string, line: number, character: number }, to: false | { uri: string, line: number, character: number } }[] = [
            // one-word name
            {
                from: { uri: projectUri + '/src/Entity/Joins/Car.php', line: 45, character: 48 },
                to: false,
            },
            {
                from: { uri: projectUri + '/src/Entity/Joins/Car.php', line: 45, character: 49 },
                to: { uri: projectUri + '/src/Entity/Joins/Person.php', line: 10, character: 0 },
            },
            {
                from: { uri: projectUri + '/src/Entity/Joins/Car.php', line: 45, character: 55 },
                to: { uri: projectUri + '/src/Entity/Joins/Person.php', line: 10, character: 0 },
            },
            {
                from: { uri: projectUri + '/src/Entity/Joins/Car.php', line: 45, character: 56 },
                to: false,
            },

            // fully qualified name
            {
                from: { uri: projectUri + '/src/Entity/Joins/Car.php', line: 51, character: 35 },
                to: false,
            },
            {
                from: { uri: projectUri + '/src/Entity/Joins/Car.php', line: 51, character: 36 },
                to: { uri: projectUri + '/src/Entity/Joins/Person.php', line: 10, character: 0 },
            },
            {
                from: { uri: projectUri + '/src/Entity/Joins/Car.php', line: 51, character: 60 },
                to: { uri: projectUri + '/src/Entity/Joins/Person.php', line: 10, character: 0 },
            },
            {
                from: { uri: projectUri + '/src/Entity/Joins/Car.php', line: 51, character: 61 },
                to: false,
            },

            // @ManyToMany, @OneToMany, @OneToOne
            {
                from: { uri: projectUri + '/src/Entity/Joins2/A.php', line: 21, character: 37 },
                to: { uri: projectUri + '/src/Entity/Joins2/B.php', line: 9, character: 0 },
            },
            {
                from: { uri: projectUri + '/src/Entity/Joins2/A.php', line: 26, character: 36 },
                to: { uri: projectUri + '/src/Entity/Joins2/C.php', line: 9, character: 0 },
            },
            {
                from: { uri: projectUri + '/src/Entity/Joins2/A.php', line: 31, character: 35 },
                to: { uri: projectUri + '/src/Entity/Joins2/D.php', line: 9, character: 0 },
            },
        ];

        for (let i = 0; i < fixtures.length; i++) {
            let { from, to } = fixtures[i];

            it(`should support definition (test ${i+1})`, async function () {
                let service = await getService();

                let actual = await service.onDefinition({
                    textDocument: { uri: from.uri },
                    position: Position.create(from.line, from.character),
                });

                let expected: Definition | null = null;
                if (to !== false) {
                    expected = {
                        uri: to.uri,
                        range: Range.create(to.line, to.character, to.line, to.character),
                    };
                }

                assert.deepEqual(actual, expected);
            });
        }
    }

    it('should support hover', async function () {
        let service = await getService();

        let actual = await service.onHover({
            textDocument: { uri: projectUri + '/src/Entity/Joins/Car.php'},
            position: Position.create(45, 49),
        }) as any;

        let actualMarkdown: string = actual.contents.value;

        assert.ok(actualMarkdown.includes('Summary of class for persons.'));
    });
});
