import * as assert from 'assert';
import { Position, Range, Definition } from 'vscode-languageserver';
import { project34Uri, getService } from './_utils';

describe('twig in symfony 3.4', function () {
    let templatesUri = project34Uri + '/app/Resources/views';

    it('should support definition for templates', async function () {
        let service = await getService();

        let actual = await service.onDefinition({
            textDocument: { uri: templatesUri + '/default/index.html.twig' },
            position: Position.create(0, 12),
        });

        let expected: Definition  = {
            uri: templatesUri + '/base.html.twig',
            range: Range.create(0, 0, 0, 0),
        };

        assert.deepEqual(actual, expected);
    });
});
