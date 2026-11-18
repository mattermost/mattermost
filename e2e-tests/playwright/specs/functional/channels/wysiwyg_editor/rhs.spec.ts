// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, postWith, test} from '@mattermost/playwright-lib';

import {expectDocument, expectRich, lastPostText, openRichComposer, pasteRich, sendRich, typeRich} from './support';

const TAGS = {tag: ['@channels', '@wysiwyg_editor']};

test.describe('WYSIWYG editor - RHS reply composer', TAGS, () => {
    test.beforeEach(async ({pw}) => {
        await pw.ensureFeatureFlag('WysiwygEditor', true);
    });

    /**
     * @objective Verify the thread's reply composer is the rich-text editor too.
     */
    test('WYSIWYG replaces the classic composer in the RHS thread', async ({pw}) => {
        const app = await openRichComposer(pw, await pw.initSetup());
        const composer = app.center.postCreate;

        // # Post a root message and open its thread
        const rootText = `thread-root ${pw.random.id()}`;
        await typeRich(composer, rootText);
        await sendRich(composer);
        const root = await postWith(app.center.postList, {text: rootText});
        await root.container.hover();
        await root.menu.replyButton.clickTo(app.rhs.postCreate);

        // * Verify the reply composer is the rich-text editor
        const reply = app.rhs.postCreate;
        await expectRich(reply);

        // # Reply with markdown. Paste, not type: opening a thread briefly re-focuses the center composer, which
        // would split a slow per-keystroke type between the two.
        await pasteRich(reply, 'wysiwyg reply **bold**');
        await expectDocument(reply, /<strong>bold<\/strong>/);
        await sendRich(reply);

        // * Verify the reply posted in the thread
        await expect.poll(() => lastPostText(app.rhs.thread)).toMatch(/wysiwyg reply.*bold/);
    });
});
