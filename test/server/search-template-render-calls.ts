import { projectUri, getService } from './_utils';
import { readFile } from '../../src/utils';
import * as nikic from '../../src/nikic-php-parser';

import { TextDocument, Position } from 'vscode-languageserver';
import * as assert from 'assert';
import URI from 'vscode-uri';

describe('search for template render calls', function () {
    it('should work', async function () {
        let documentUri = projectUri + '/src/Controller/PController.php';
        let documentFsPath = URI.parse(documentUri).fsPath;

        let service = await getService();

        let code = await readFile(documentFsPath);

        let document = TextDocument.create(documentUri, 'php', 1, code);

        let stmts = await nikic.parse(code) as nikic.Statement[];
        let project = service.findFileProject(documentUri);
        let actual = project!.findTemplateRenderCalls(stmts, documentUri, 'App\\Controller\\PController');

        // I don't want to test deleted things
        for (let call of actual) {
            delete call.callerUri;
            delete call.className;
            delete call.methodName;
            for (let param of call.params) {
                delete param.valueNode;
                delete param.methodNode;
            }
        }

        let expected = [
            {
                name: 'template.html.twig',
                params: [],
            },
            {
                name: 'subdir/template-2.html.twig',
                params: [
                    {
                        name: 'param',
                        offset: document.offsetAt(Position.create(28, 16)),
                    },
                    {
                        name: 'param2',
                        offset: document.offsetAt(Position.create(29, 16)),
                    },
                ],
            },
            {
                name: 'template.html.twig',
                params: [
                    {
                        name: 'param',
                        offset: document.offsetAt(Position.create(39, 56)),
                    },
                ],
            },
        ];

        assert.deepEqual(actual, expected);
    });
});
