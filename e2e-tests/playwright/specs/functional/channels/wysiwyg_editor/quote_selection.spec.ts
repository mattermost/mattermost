// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, expect, postWith, settle, test} from '@mattermost/playwright-lib';

import {selectTextWithMouse} from '../messaging/quote_selection_helpers';

import {blockquoteIn, expectDocument, openRichComposer} from './support';

const TAGS = {tag: ['@channels', '@wysiwyg_editor']};

test.describe('WYSIWYG editor - quoting selected text', TAGS, () => {
    test.beforeEach(async ({pw}) => {
        await pw.ensureFeatureFlag('WysiwygEditor', true);
    });

    /**
     * @objective Verify that quoting selected text adds a blockquote to the WYSIWYG editor and that
     * the reply typed right after it goes below the quote rather than into it.
     */
    test('quotes selected text and types the reply below the quote', async ({pw}) => {
        const setup = await pw.initSetup();
        const {userClient, team} = setup;
        const townSquare = await userClient.getChannelByName(team.id, 'town-square');
        const created = await userClient.createPost({
            channel_id: townSquare.id,
            message: 'Ullamcorper eu mi, dictumst nec. Diam sapien pellentesque vestibulum pretium eget massa.',
        });

        const app = await openRichComposer(pw, setup);
        await app.channelsPage.goto({team, channel: townSquare});
        const composer = app.center.postCreate;
        const editor = composer.message.container;
        await expect(editor).toHaveAttribute('contenteditable', 'true');

        // # Select part of the message and quote it
        const post = app.center.postList.post(created);
        await selectTextWithMouse(post.message.container.locator, 'Diam sapien pellentesque');
        await app.quoteSelection.quoteButton.click();

        // * Verify the editor has the quote and is focused
        await expect(blockquoteIn(editor)).toHaveText('Diam sapien pellentesque');
        await expect(editor).toBeFocused();

        // # Type a reply without moving the caret
        await app.page.keyboard.type('What do you mean?');

        // * Verify the reply went below the quote, not into it
        await expect(blockquoteIn(editor)).toHaveText('Diam sapien pellentesque');
        await expectDocument(composer, /<\/blockquote>\s*<p>[^<]*What do you mean\?/);

        // # Send the message
        await expect(composer.sendButton).toBeEnabled();
        await settle(composer.message.container, {wait: Api.CreatePost}).press('Enter');

        // * Verify the posted message contains the quote followed by the reply
        const reply = await postWith(app.center.postList, {text: 'What do you mean?'});
        await expect(blockquoteIn(reply.message.container)).toHaveText('Diam sapien pellentesque');
        await expect(reply.message.container).toContainText('What do you mean?');
    });
});
