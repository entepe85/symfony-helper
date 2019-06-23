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
});
