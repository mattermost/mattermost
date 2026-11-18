// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {clearRich, expectDocument, lastPostText, openRichComposer, sendRich, typeRich} from './support';

const TAGS = {tag: ['@channels', '@wysiwyg_editor']};

test.describe('WYSIWYG editor - markdown-as-you-type rich text', TAGS, () => {
    test.beforeEach(async ({pw}) => {
        await pw.ensureFeatureFlag('WysiwygEditor', true);
    });

    /**
     * @objective Verify bold, italic and strikethrough markdown become inline formatting, and post.
     */
    test('bold, italic, and strikethrough marks render inline', async ({pw}) => {
        const app = await openRichComposer(pw, await pw.initSetup());
        const composer = app.center.postCreate;

        // # Type the three marks as markdown
        await typeRich(composer, '**bold** *italic* ~~strike~~');

        // * Verify each renders as formatting
        await expectDocument(composer, /<strong>bold<\/strong>/);
        await expectDocument(composer, /<em>italic<\/em>/);
        await expectDocument(composer, /<s>strike<\/s>/);

        // # Send it
        await sendRich(composer);

        // * Verify the post has the text
        await expect.poll(() => lastPostText(app.center.postList)).toMatch(/bold.*italic.*strike/);
    });

    /**
     * @objective Verify heading, list and blockquote markdown shortcuts become blocks.
     */
    test('heading, list, and blockquote markdown shortcuts are recognized', async ({pw}) => {
        const app = await openRichComposer(pw, await pw.initSetup());
        const composer = app.center.postCreate;

        // # Type a heading
        await typeRich(composer, '## heading');

        // * Verify it is a heading
        await expectDocument(composer, /<h2[^>]*>heading<\/h2>/);

        // # Replace it with a list item
        await clearRich(composer);
        await typeRich(composer, '- item one');

        // * Verify it is a list item
        await expectDocument(composer, /<ul[^>]*><li[^>]*>.*item one.*<\/li>/);

        // # Replace it with a quote
        await clearRich(composer);
        await typeRich(composer, '> quoted');

        // * Verify it is a quote
        await expectDocument(composer, /<blockquote[^>]*>.*quoted.*<\/blockquote>/);
    });

    /**
     * @objective Verify a message of only emoji gets jumbo emoji, and loses them once text is added.
     */
    test('all-emoji document gets the jumbo class', async ({pw}) => {
        const app = await openRichComposer(pw, await pw.initSetup());
        const composer = app.center.postCreate;

        // # Type only emoji
        await typeRich(composer, '😀😀😀');

        // * Verify they are jumbo
        await expectDocument(composer, /WysiwygEditor__emoji--jumbo/);

        // # Add text
        await typeRich(composer, ' text');

        // * Verify they are ordinary emoji
        await expectDocument(composer, /WysiwygEditor__emoji--jumbo/, true);
        await expectDocument(composer, /WysiwygEditor__emoji/);
    });
});
