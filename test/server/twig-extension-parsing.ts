import { projectUri } from './_utils';
import { TwigExtensionCallable, findTwigExtensionElements } from '../../src/project';
import { readFile } from '../../src/utils';
import * as php from '../../src/php';

import { TextDocument, Position } from 'vscode-languageserver';
import * as assert from 'assert';
import URI from 'vscode-uri';

describe('search twig extension for new functions, filters and tests', function () {
    let projectFsPath = URI.parse(projectUri).fsPath;

    it('should work for functions', async function () {
        let filePath = projectFsPath + '/src/Twig/ExtensionA.php';

        let code = await readFile(filePath);
        let document = TextDocument.create('temp://temp.php', 'php', 1, code);

        let actual = (await findTwigExtensionElements(code)).elements;

        let expected: TwigExtensionCallable[] = [
            {
                type: 'function',
                name: 'funcA',
                nameStartOffset: document.offsetAt(Position.create(12, 34)),
                nameEndOffset: document.offsetAt(Position.create(12, 41)),
                constructorOffset: document.offsetAt(Position.create(12, 17)),
                implementation: {
                    offset: document.offsetAt(Position.create(25, 4)),
                    params: [],
                    returnType: new php.AnyType,
                },
            },
            {
                type: 'function',
                name: 'funcB',
                nameStartOffset: document.offsetAt(Position.create(18, 16)),
                nameEndOffset: document.offsetAt(Position.create(18, 23)),
                constructorOffset: document.offsetAt(Position.create(17, 12)),
                implementation: {
                    offset: document.offsetAt(Position.create(36, 4)),
                    params: [
                        {
                            name: 'param',
                        },
                        {
                            name: 'flag',
                        },
                    ],
                    help: 'This function does something\nweird and unexpected.',
                    returnType: new php.AnyType,
                },
            },
        ];

        assert.deepEqual(actual, expected);
    });

    it('should work for tests', async function () {
        let code = await readFile(projectFsPath + '/src/Twig/ExtensionB.php');

        let actual = await findTwigExtensionElements(code);

        let testA = actual.elements.find(row => row.type === 'test' && row.name === 'testA');
        assert.deepEqual(testA!.implementation!.params, []);

        let testB = actual.elements.find(row => row.type === 'test' && row.name === 'testB');
        assert.deepEqual(testB!.implementation!.params, [{ name: 'param' }, { name: 'param2' }]);
    });

    it('should work for filters', async function () {
        let code = await readFile(projectFsPath + '/src/Twig/ExtensionC.php');

        let actual = await findTwigExtensionElements(code);

        let filterA = actual.elements.find(row => row.type === 'filter' && row.name === 'filterA');
        assert.deepEqual(filterA!.implementation!.params, []);

        let filterB = actual.elements.find(row => row.type === 'filter' && row.name === 'filterB');
        assert.deepEqual(filterB!.implementation!.params, [{ name: 'param' }]);
    });

    it('should know about context-aware and environment-aware functions and filters', async function () {
        let code = await readFile(projectFsPath + '/src/Twig/Extension4.php');

        let actual = await findTwigExtensionElements(code);

        let flt = actual.elements.find(row => row.name === 'flt4');
        assert.deepEqual(flt!.implementation!.params, [{ name: 'param' }]);

        let fnc = actual.elements.find(row => row.name === 'func4');
        assert.deepEqual(fnc!.implementation!.params, [ { name: 'argA' }, { name: 'argB' }]);
    });

    it('should support closures', async function () {
        let filePath = projectFsPath + '/src/Twig/Extension6.php';

        let code = await readFile(filePath);
        let document = TextDocument.create('temp://temp.php', 'php', 1, code);

        let actual = (await findTwigExtensionElements(code)).elements.find(row => row.name === 'function2') as TwigExtensionCallable;

        let expectedImplementation = {
            offset: document.offsetAt(Position.create(10, 53)),
            params: [
                {
                    name: 'aa',
                },
                {
                    name: 'bb',
                },
            ],
            returnType: new php.AnyType,
        };

        assert.deepEqual(actual.implementation, expectedImplementation);
    });
});
