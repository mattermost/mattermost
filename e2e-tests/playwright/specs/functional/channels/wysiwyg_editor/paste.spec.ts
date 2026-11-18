// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {expectDocument, openRichComposer, pasteRich} from './support';

const TAGS = {tag: ['@channels', '@wysiwyg_editor']};

test.describe('WYSIWYG editor - paste', TAGS, () => {
    test.beforeEach(async ({pw}) => {
        await pw.ensureFeatureFlag('WysiwygEditor', true);
    });

    /**
     * @objective Verify pasted markdown becomes formatting.
     */
    test('pasting plain markdown parses into formatted content', async ({pw}) => {
        const app = await openRichComposer(pw, await pw.initSetup());
        const composer = app.center.postCreate;

        // # Paste markdown
        await pasteRich(composer, '**bold** and *italic* and `code`');

        // * Verify it is formatted
        await expectDocument(composer, /<strong>bold<\/strong>/);
        await expectDocument(composer, /<em>italic<\/em>/);
        await expectDocument(composer, /<code>code<\/code>/);
    });

    /**
     * @objective Verify pasted text without markdown stays plain.
     */
    test('pasting plain text without markdown syntax stays plain', async ({pw}) => {
        const app = await openRichComposer(pw, await pw.initSetup());
        const composer = app.center.postCreate;

        // # Paste plain text
        await pasteRich(composer, 'just some plain words no formatting');

        // * Verify it is pasted without formatting
        await expect(composer.message.container).toContainText('just some plain words no formatting');
        await expectDocument(composer, /<(strong|em)>/, true);
    });
});
