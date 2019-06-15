import { projectUri, getService } from './_utils';
import { readFile } from '../../src/utils';

import * as assert from 'assert';
import { Position, Definition, Range } from 'vscode-languageserver';
import URI from 'vscode-uri';

describe('expressions in templates', function () {
    let projectFsPath = URI.parse(projectUri).fsPath;
    let documentUri = projectUri + '/templates/fixture-34.html.twig';

    it('should support completion (test 1)', async function () {
        let service = await getService();

        let actual = await service.onCompletition({
            textDocument: { uri: documentUri },
            position: Position.create(3, 22),
        });

        let expectedLabels = ['prop1', 'prop2', 'sum', 'sum2'];
        let unexpectedLabels = ['prop3', 'prop4', 'sum3', 'sum4', '__constructor', '__xxxx'];

        // test that 'unexpectedLabels' is really declared
        let utilsCode = await readFile(projectFsPath + '/src/Logic/Utils.php');
        assert.ok(utilsCode.includes('protected $prop3;'));
        assert.ok(utilsCode.includes('private $prop4;'));
        assert.ok(utilsCode.includes('protected function sum3()'));
        assert.ok(utilsCode.includes('private function sum4()'));
        assert.ok(utilsCode.includes('public function __constructor()'));
        assert.ok(utilsCode.includes('public function __xxxx()'));

        let actualLabels = actual.items.map(row => row.label);

        for (let label of expectedLabels) {
            assert.ok(actualLabels.indexOf(label) >= 0);
        }

        for (let label of unexpectedLabels) {
            assert.ok(actualLabels.indexOf(label) < 0);
        }
    });

    it('should support definition', async function () {
        let service = await getService();

        let actual = await service.onDefinition({
            textDocument: { uri: documentUri },
            position: Position.create(3, 20),
        });

        let expected: Definition = {
            uri: projectUri + '/src/Logic/Utils.php',
            range: Range.create(9, 4, 9, 4),
        };

        assert.deepEqual(actual, expected);
    });
});
