import * as assert from 'assert';
import { Position, Range, CompletionItem, TextEdit } from 'vscode-languageserver';
import { projectUri, getService } from './_utils';

describe('autocomplete twig tags', function () {
    it('should work', async function () {
        let service = await getService();

        let documentUri = projectUri + '/templates/fixture-17.html.twig';

        {
            // some tests for first line of {% block %}

            let actual = await service.onCompletition({
                textDocument: { uri: documentUri },
                position: Position.create(3, 0),
            });

            let actualItemForIf = actual.items.filter(row => row.label === '%if')[0];

            let expectedItemForIf: CompletionItem = {
                label: '%if',
                filterText: 'if',
                textEdit: {
                    range: Range.create(3, 0, 3, 0),
                    newText: '{% if $1 %}\n\t$0\n{% endif %}',
                },
                insertTextFormat: 2,
                kind: 15,
            };

            assert.deepEqual(actualItemForIf, expectedItemForIf);

            let actualFilterTexts = actual.items.map(row => row.filterText);
            let expectedFilterTexts = ['block', 'include', 'set', 'spaceless']; // some random tags

            for (let tag of expectedFilterTexts) {
                assert.ok(actualFilterTexts.indexOf(tag) >= 0);
            }
        }

        {
            // test for 'textEdit' of %for

            let actual = await service.onCompletition({
                textDocument: { uri: documentUri },
                position: Position.create(6, 6),
            });

            let actualItem = actual.items.filter(row => row.label === '%for')[0];

            let expectedItem: CompletionItem = {
                label: '%for',
                filterText: 'for',
                textEdit: {
                    range: Range.create(6, 4, 6, 6),
                    newText: '{% for $1 in $2 %}\n\t$0\n{% endfor %}',
                },
                insertTextFormat: 2,
                kind: 15,
            };

            assert.deepEqual(actualItem, expectedItem);
        }

        {
            // don't autocomplete in tags, expressions or comments

            let fixtures = [
                [9, 6], // tag
                [9, 12], // tag
                [10, 7], // comment
                [10, 15], // comment
                [11, 7], // expression
                [11, 16], // expression
            ];

            let tags = ['for', 'macro', 'set'];

            for (let [line, character] of fixtures) {
                let actual = await service.onCompletition({
                    textDocument: { uri: documentUri },
                    position: Position.create(line, character),
                });

                let items = actual.items;

                let labels = items.map(row => row.label);
                let filterTexts = items.map(row => row.filterText);

                for (let tag of tags) {
                    assert.ok(labels.indexOf('%' + tag) < 0);
                    assert.ok(filterTexts.indexOf(tag) < 0);
                }
            }
        }
    });

    it('should not autocomplete anything in finished closing tags', async function () {
        let service = await getService();

        let documentUri = projectUri + '/templates/fixture-18.html.twig';

        let fixtures = [
            [4, 13],
            [5, 12],
        ];

        for (let row of fixtures) {
            let actual = await service.onCompletition({
                textDocument: { uri: documentUri },
                position: Position.create(row[0], row[1]),
            });

            assert.ok(actual.items.length === 0);
        }
    });

    it('should autocomplete {%end*%} and {%else%} from html code', async function () {
        let documentUri = projectUri + '/templates/fixture-40.html.twig';

        let service = await getService();

        let fixtures = [
            [7, 0],
            [7, 2],
        ];

        let expectedLabels = ['%elseif', '%else', '%endif'];

        let unexpectedLabels = ['endfor', 'endblock'];

        for (let [line, character] of fixtures) {
            let actual = await service.onCompletition({
                textDocument: { uri: documentUri },
                position: Position.create(line, character),
            });

            let actualLabels = actual.items.map(row => row.label);

            for (let label of expectedLabels) {
                assert.ok(actualLabels.indexOf(label) >= 0);
            }

            for (let label of unexpectedLabels) {
                assert.ok(actualLabels.indexOf(label) < 0);
            }
        }
    });

    it(`should autoindent 'end*' and 'else*'`, async function () {
        let documentUri = projectUri + '/templates/fixture-40.html.twig';

        let service = await getService();

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(8, 10),
        });

        let actualItem = actual.items.find(row => row.label === '%elseif') as CompletionItem;

        let expectedTextEdit: TextEdit = {
            newText: '    ' /* 4 spaces */,
            range: Range.create(8, 0, 8, 8),
        };

        assert.deepEqual(actualItem.additionalTextEdits![0], expectedTextEdit);
    });

    it(`should not autoindent 'end*' and 'else*' if there are extra characters before match`, async function () {
        let documentUri = projectUri + '/templates/fixture-40.html.twig';

        let service = await getService();

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(9, 10),
        });

        let actualItem = actual.items.find(row => row.label === '%endif') as CompletionItem;

        assert.equal(actualItem.additionalTextEdits, undefined);
    });
});
