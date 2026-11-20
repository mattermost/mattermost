// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {expectDocument, openRichComposer, typeRich} from './support';

const TAGS = {tag: ['@channels', '@wysiwyg_editor']};

test.describe('WYSIWYG editor - formatting bar', TAGS, () => {
    test.beforeEach(async ({pw}) => {
        await pw.ensureFeatureFlag('WysiwygEditor', true);
    });

    /**
     * @objective Verify the bold and italic buttons format the selection.
     */
    test('bold and italic toolbar buttons wrap the selection', async ({pw}) => {
        const app = await openRichComposer(pw, await pw.initSetup());
        const composer = app.center.postCreate;

        // # Type a word and select it
        await typeRich(composer, 'formatme');
        await composer.message.container.press('ControlOrMeta+a');
        await expect(composer.message.container).toBeFocused();

        // # Make it bold
        await composer.formattingBar.control('bold').setPressed(true);
        await expect(composer.formattingBar.control('bold')).toBePressed();

        // * Verify it is bold
        await expectDocument(composer, /<strong>formatme<\/strong>/);

        // # Make it italic too
        await composer.formattingBar.control('italic').setPressed(true);
        await expect(composer.formattingBar.control('italic')).toBePressed();

        // * Verify it is bold and italic
        await expectDocument(composer, /<strong><em>formatme<\/em><\/strong>|<em><strong>formatme<\/strong><\/em>/);
    });
});
