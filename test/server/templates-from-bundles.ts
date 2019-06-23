import * as assert from 'assert';
import { projectUri, getService } from './_utils';
import { Position, Definition, Range } from 'vscode-languageserver';

describe('templates from bundles', function () {
    it('definition of template name should work', async function () {
        let documentUri = projectUri + '/templates/template-50.html.twig';
        let bundleViewsFolder = projectUri + '/vendor/megacorp/core-bundle/src/Resources/views';
        let overriddenBundleViewsFolder = projectUri + '/templates/bundles/MegacorpCoreBundle';

        let service = await getService();

        let fixtures: { from: [number, number, string], to: string[] }[] = [
            { from: [0, 12, documentUri], to: [bundleViewsFolder + '/basic-layout.html.twig'] },
            { from: [0, 48, documentUri], to: [bundleViewsFolder + '/basic-layout.html.twig'] },
            { from: [4, 12, documentUri], to: [overriddenBundleViewsFolder + '/widgets/table.html.twig', bundleViewsFolder + '/widgets/table.html.twig'] }, // overridden template
            { from: [5, 12, documentUri], to: [bundleViewsFolder + '/widgets/table.html.twig'] }, // overridden template with '!'
            { from: [2, 16, bundleViewsFolder + '/widgets/table.html.twig'], to: [bundleViewsFolder + '/widgets/table-row.html.twig'] }, // template from bundle folder
        ];

        for (let i = 0; i < fixtures.length; i++) {
            let { from, to } = fixtures[i];

            let actual = await service.onDefinition({
                textDocument: { uri: from[2] },
                position: Position.create(from[0], from[1]),
            });

            let expected: Definition = to.map(str => { return { uri: str, range: Range.create(0, 0, 0, 0) }; });

            assert.deepEqual(actual, expected, `fixture ${i} failed`);
        }
    });

    it('definition of block should work', async function () {
        let service = await getService();

        let actual = await service.onDefinition({
            textDocument: { uri: projectUri + '/templates/template-50.html.twig' },
            position: Position.create(2, 16),
        });

        let expected: Definition = [
            {
                uri: projectUri + '/vendor/megacorp/core-bundle/src/Resources/views/basic-layout.html.twig',
                range: Range.create(7, 4, 7, 4),
            }
        ];

        assert.deepEqual(actual, expected);
    });

    it('completion of block name should work', async function () {
        let service = await getService();

        let actual = await service.onCompletition({
            textDocument: { uri: projectUri + '/templates/template-50.html.twig' },
            position: Position.create(2, 9),
        });

        let actualLabels = actual.items.map(row => row.label);

        let expectedLabels = ['content', 'megacorp_special'];

        for (let label of expectedLabels) {
            assert.ok(actualLabels.indexOf(label) >= 0);
        }
    });
});
