// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {expectDocument, lastPostText, openRichComposer, sendRich, typeRich} from './support';

const TAGS = {tag: ['@channels', '@wysiwyg_editor']};

test.describe('WYSIWYG editor - composing and posting', TAGS, () => {
    test.beforeEach(async ({pw}) => {
        await pw.ensureFeatureFlag('WysiwygEditor', true);
    });

    /**
     * @objective Verify a plain message posts with the Send button.
     */
    test('posts a plain-text message with button', async ({pw}) => {
        const app = await openRichComposer(pw, await pw.initSetup());
        const composer = app.center.postCreate;

        // # Type a message and send it with the button
        const msg = `wysiwyg plain ${pw.random.id()}`;
        await typeRich(composer, msg);
        await sendRich(composer);

        // * Verify it posted and the editor emptied
        await expect.poll(() => lastPostText(app.center.postList)).toContain(msg);
        await expect(composer.message.container).toHaveText('');
    });

    /**
     * @objective Verify a plain message posts with Enter.
     */
    test('posts a plain-text message with enter key', async ({pw}) => {
        const app = await openRichComposer(pw, await pw.initSetup());
        const composer = app.center.postCreate;

        // # Type a message and send it with Enter, once the draft is ready
        const msg = `wysiwyg plain ${pw.random.id()}`;
        await typeRich(composer, msg);
        await expect(composer.sendButton).toBeEnabled();
        await composer.message.container.press('Enter');

        // * Verify it posted and the editor emptied
        await expect.poll(() => lastPostText(app.center.postList)).toContain(msg);
        await expect(composer.message.container).toHaveText('');
    });

    /**
     * @objective Verify the placeholder shows only while the editor is empty.
     */
    test('placeholder shows when empty and hides after typing', async ({pw}) => {
        const app = await openRichComposer(pw, await pw.initSetup());
        const composer = app.center.postCreate;

        // * Verify the empty editor shows its placeholder
        await expectDocument(composer, /^(?=.*\bis-editor-empty\b)(?=.*\bdata-placeholder="[^"]+")/);

        // # Type a character
        await typeRich(composer, 'x');

        // * Verify the placeholder is gone
        await expectDocument(composer, /is-editor-empty/, true);
    });

    /**
     * @objective Verify ArrowUp in an empty editor opens the inline edit for the user's last post.
     */
    test('ArrowUp on empty composer opens the inline edit for the last post', async ({pw}) => {
        const app = await openRichComposer(pw, await pw.initSetup());
        const composer = app.center.postCreate;

        // # Post a message, then press ArrowUp in the empty editor
        await typeRich(composer, `edit-me ${pw.random.id()}`);
        await sendRich(composer);
        await composer.message.container.press('ArrowUp');

        // * Verify the inline editor opens
        await expect(app.postEdit.editor.message.container).toBeVisible();
    });
});
