// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    Api,
    expect,
    lastPost,
    postWith,
    setWysiwygUserPreference,
    settle,
    test,
    type App,
} from '@mattermost/playwright-lib';

import {blockquoteIn, expectDocument, expectRich} from '../wysiwyg_editor/support';

const TAGS = {tag: '@channels'};

const MESSAGE = ['Ullamcorper eu mi, dictumst nec.', '', 'Diam sapien **pellentesque** vestibulum.'].join('\n');
const QUOTE = ['> Ullamcorper eu mi, dictumst nec.', '>', '> Diam sapien **pellentesque** vestibulum.', '', ''].join(
    '\n',
);

type Post = ReturnType<App['center']['postList']['post']>;

/** Opens a post's menu. */
async function openPostMenu(app: App, post: Post | ReturnType<App['rhs']['thread']['post']>) {
    await post.container.hover();
    return post.menu.dotMenuButton.clickTo(app.postDotMenu);
}

/**
 * @objective Verify that Quote in the post menu quotes the whole message into the channel message
 * box, and that the quote and the reply typed below it are posted together.
 */
test('quotes a post into the channel message box from the post menu', TAGS, async ({pw}) => {
    const {user, userClient, team, townSquare} = await pw.initSetup();
    await userClient.createPost({channel_id: townSquare.id, message: MESSAGE});

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: townSquare});
    await expect(app.center.postCreate).toBeVisible();

    // # Open the post menu and click Quote
    const menu = await openPostMenu(app, await lastPost(app.center.postList));
    await menu.quoteMenuItem.click();

    // * Verify the message is quoted with its Markdown, followed by an empty line, and the box is focused
    const input = app.center.postCreate.message.container;
    await expect(input).toHaveValue(QUOTE);
    await expect(input).toBeFocused();

    // # Type a reply below the quote and send it
    await app.page.keyboard.type('What do you mean?');
    await expect(input).toHaveValue(`${QUOTE}What do you mean?`);
    await settle(app.center.postCreate.sendButton, {wait: Api.CreatePost}).click();

    // * Verify the posted message contains the quote followed by the reply
    const reply = await postWith(app.center.postList, {text: 'What do you mean?'});
    await expect(blockquoteIn(reply.message.container)).toContainText('Diam sapien pellentesque vestibulum.');
    await expect(reply.message.container).toContainText('What do you mean?');
});

/**
 * @objective Verify that pressing Q while the post menu is open quotes the post.
 */
test('quotes a post with the Q shortcut in the post menu', TAGS, async ({pw}) => {
    const {user, userClient, team, townSquare} = await pw.initSetup();
    await userClient.createPost({channel_id: townSquare.id, message: MESSAGE});

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: townSquare});
    await expect(app.center.postCreate).toBeVisible();

    // # Open the post menu and press Q
    const menu = await openPostMenu(app, await lastPost(app.center.postList));
    await expect(menu).toBeVisible();
    await app.page.keyboard.press('q');

    // * Verify the menu closed and the message is quoted into the message box
    await expect(menu).toBeHidden();
    await expect(app.center.postCreate.message.container).toHaveValue(QUOTE);
});

/**
 * @objective Verify that quoting a reply from the post menu in the RHS quotes it into the thread's
 * reply box rather than the channel message box.
 */
test('quotes a reply in the RHS into the thread reply box', TAGS, async ({pw}) => {
    const {user, userClient, team, townSquare} = await pw.initSetup();
    const root = await userClient.createPost({
        channel_id: townSquare.id,
        message: 'What are we doing for the logging points?',
    });
    await userClient.createPost({channel_id: townSquare.id, root_id: root.id, message: MESSAGE});

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: townSquare});
    await expect(app.center.postCreate).toBeVisible();

    // # Open the thread in the RHS
    const rootPost = app.center.postList.post({id: root.id});
    await rootPost.container.hover();
    await rootPost.menu.replyButton.clickTo(app.rhs.postCreate);

    // # Quote the reply from its post menu
    const replyPost = await postWith(app.rhs.thread, {text: 'Ullamcorper eu mi, dictumst nec.'});
    const menu = await openPostMenu(app, replyPost);
    await menu.quoteMenuItem.click();

    // * Verify the quote went into the thread reply box and not the channel message box
    await expect(app.rhs.postCreate.message.container).toHaveValue(QUOTE);
    await expect(app.center.postCreate.message.container).toHaveValue('');
});

test.describe('WYSIWYG editor', {tag: ['@channels', '@wysiwyg_editor']}, () => {
    test.beforeEach(async ({pw}) => {
        await pw.ensureFeatureFlag('WysiwygEditor', true);
    });

    /**
     * @objective Verify that quoting a post from the post menu into an empty WYSIWYG editor adds a
     * blockquote and that the reply typed right after it goes below the quote rather than into it.
     */
    test('quotes a post from the post menu and types the reply below the quote', async ({pw}) => {
        const {user, userClient, team, townSquare} = await pw.initSetup();
        await setWysiwygUserPreference(userClient, user.id, true);
        await userClient.createPost({channel_id: townSquare.id, message: 'Diam sapien pellentesque vestibulum.'});

        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: townSquare});
        const composer = app.center.postCreate;
        await expectRich(composer);

        // # Quote the post from its post menu
        const menu = await openPostMenu(app, await lastPost(app.center.postList));
        await menu.quoteMenuItem.click();

        // * Verify the editor has the quote and is focused
        const editor = composer.message.container;
        await expect(blockquoteIn(editor)).toHaveText('Diam sapien pellentesque vestibulum.');
        await expect(editor).toBeFocused();

        // # Type a reply without moving the caret
        await app.page.keyboard.type('What do you mean?');

        // * Verify the reply went below the quote, not into it
        await expect(blockquoteIn(editor)).toHaveText('Diam sapien pellentesque vestibulum.');
        await expectDocument(composer, /<\/blockquote>\s*<p>[^<]*What do you mean\?/);

        // # Send the message by pressing Enter
        await settle(editor, {wait: Api.CreatePost}).press('Enter');

        // * Verify the posted message contains the quote followed by the reply
        const reply = await postWith(app.center.postList, {text: 'What do you mean?'});
        await expect(blockquoteIn(reply.message.container)).toHaveText('Diam sapien pellentesque vestibulum.');
        await expect(reply.message.container).toContainText('What do you mean?');
    });
});
