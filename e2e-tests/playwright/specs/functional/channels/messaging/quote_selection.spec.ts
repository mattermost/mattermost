// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {selectTextWithMouse} from './quote_selection_helpers';

const TAGS = {tag: '@messaging'};

const MESSAGE =
    'Ullamcorper eu mi, dictumst nec. Diam sapien pellentesque vestibulum pretium eget massa. Senectus ultrices tincidunt ultricies gravida.';

/**
 * @objective Verify that text selected in a post can be quoted into the channel message box,
 * and that the quote and the reply typed below it are posted together.
 */
test('quotes text selected in a post into the channel message box', TAGS, async ({pw}) => {
    const {user, userClient, team} = await pw.initSetup();
    const townSquare = await userClient.getChannelByName(team.id, 'town-square');
    await userClient.createPost({channel_id: townSquare.id, message: MESSAGE});

    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    const post = await channelsPage.getLastPost();
    const quoteButton = page.getByRole('button', {name: 'Quote selection'});
    const {postCreate} = channelsPage.centerView;

    // * Verify the quote button isn't shown without a selection
    await expect(quoteButton).not.toBeVisible();

    // # Select part of the message from left to right
    await selectTextWithMouse(post.body.locator('.post-message__text'), 'Diam sapien pellentesque');

    // # Quote the selection
    await expect(quoteButton).toBeVisible();
    await quoteButton.click();

    // * Verify the quote is in the message box followed by an empty line, and the button is gone
    await expect(postCreate.input).toHaveValue('> Diam sapien pellentesque\n\n');
    await expect(postCreate.input).toBeFocused();
    await expect(quoteButton).not.toBeVisible();

    // # Type a reply below the quote and send it
    await page.keyboard.type('What do you mean?');
    await postCreate.sendMessage();

    // * Verify the posted message contains the quote followed by the reply
    const reply = await channelsPage.getLastPost();
    await expect(reply.body.locator('blockquote')).toHaveText('Diam sapien pellentesque');
    await reply.toContainText('What do you mean?');
});

/**
 * @objective Verify that a right to left selection can be quoted too, and that a second quote is
 * added after what's already in the message box.
 */
test('adds a quote of a right to left selection after the existing draft', TAGS, async ({pw}) => {
    const {user, userClient, team} = await pw.initSetup();
    const townSquare = await userClient.getChannelByName(team.id, 'town-square');
    await userClient.createPost({channel_id: townSquare.id, message: MESSAGE});

    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    const post = await channelsPage.getLastPost();
    const quoteButton = page.getByRole('button', {name: 'Quote selection'});
    const {postCreate} = channelsPage.centerView;

    // # Write a draft first
    await postCreate.writeMessage('About this:');

    // # Select part of the message from right to left and quote it
    await selectTextWithMouse(post.body.locator('.post-message__text'), 'Senectus ultrices', {backward: true});
    await quoteButton.click();

    // * Verify the quote was added on its own after the draft
    await expect(postCreate.input).toHaveValue('About this:\n\n> Senectus ultrices\n\n');
});

/**
 * @objective Verify that text selected in a reply shown in the RHS is quoted into the thread's
 * reply box rather than the channel's message box.
 */
test('quotes text selected in the RHS into the thread reply box', TAGS, async ({pw}) => {
    const {user, userClient, team} = await pw.initSetup();
    const townSquare = await userClient.getChannelByName(team.id, 'town-square');
    const root = await userClient.createPost({
        channel_id: townSquare.id,
        message: 'What are we doing for the logging points?',
    });
    await userClient.createPost({channel_id: townSquare.id, root_id: root.id, message: MESSAGE});

    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Open the thread in the RHS
    const rootPost = await channelsPage.centerView.getPostById(root.id);
    await rootPost.reply();
    await channelsPage.sidebarRight.toBeVisible();

    // # Select text in the reply and quote it
    const replyPost = await channelsPage.sidebarRight.getLastPost();
    await selectTextWithMouse(replyPost.body.locator('.post-message__text'), 'pretium eget massa');
    await page.getByRole('button', {name: 'Quote selection'}).click();

    // * Verify the quote went into the thread reply box and not the channel message box
    await expect(channelsPage.sidebarRight.postCreate.input).toHaveValue('> pretium eget massa\n\n');
    await expect(channelsPage.centerView.postCreate.input).toHaveValue('');
});

/**
 * @objective Verify that quoting formatted text keeps its Markdown formatting, such as headings,
 * lists, code blocks and links.
 */
test('keeps the Markdown formatting of the quoted text', TAGS, async ({pw}) => {
    const {user, userClient, team} = await pw.initSetup();
    const townSquare = await userClient.getChannelByName(team.id, 'town-square');
    await userClient.createPost({
        channel_id: townSquare.id,
        message: [
            '## Project Update',
            '',
            'We are making **excellent** progress.',
            '',
            '* **Performance:** faster',
            '* Security',
            '',
            '```javascript',
            'const client = 1;',
            '```',
            '',
            'Check the [dashboard](https://example.com).',
        ].join('\n'),
    });

    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Select the whole message and quote it
    const post = await channelsPage.getLastPost();
    await selectTextWithMouse(post.body.locator('.post-message__text'), 'Project Update', {untilPhrase: 'dashboard'});
    await page.getByRole('button', {name: 'Quote selection'}).click();

    // * Verify the quote keeps the heading, emphasis, list, code block and link
    await expect(channelsPage.centerView.postCreate.input).toHaveValue(
        [
            '> ## Project Update',
            '>',
            '> We are making **excellent** progress.',
            '>',
            '> -   **Performance:** faster',
            '> -   Security',
            '>',
            '> ```javascript',
            '> const client = 1;',
            '> ```',
            '>',
            '> Check the [dashboard](https://example.com)',
            '',
            '',
        ].join('\n'),
    );
});

/**
 * @objective Verify that the quote button can be reached with Tab and used with the keyboard.
 */
test('quotes the selection with the keyboard', TAGS, async ({pw}) => {
    const {user, userClient, team} = await pw.initSetup();
    const townSquare = await userClient.getChannelByName(team.id, 'town-square');
    await userClient.createPost({channel_id: townSquare.id, message: MESSAGE});

    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Select part of the message
    const post = await channelsPage.getLastPost();
    await selectTextWithMouse(post.body.locator('.post-message__text'), 'Diam sapien pellentesque');
    const quoteButton = page.getByRole('button', {name: 'Quote selection'});
    await expect(quoteButton).toBeVisible();

    // # Move to the quote button with Tab and press Enter
    await page.keyboard.press('Tab');
    await expect(quoteButton).toBeFocused();
    await page.keyboard.press('Enter');

    // * Verify the quote is in the message box
    await expect(channelsPage.centerView.postCreate.input).toHaveValue('> Diam sapien pellentesque\n\n');
});

/**
 * @objective Verify that quoting isn't offered in an archived channel, where nothing can be posted.
 */
test('does not offer to quote in an archived channel', TAGS, async ({pw}) => {
    const {user, userClient, team} = await pw.initSetup();
    const channel = await userClient.createChannel(
        pw.random.channel({teamId: team.id, name: 'quote-archived', displayName: 'Quote Archived', type: 'O'}),
    );
    const archivedPost = await userClient.createPost({channel_id: channel.id, message: MESSAGE});
    await userClient.deleteChannel(channel.id);

    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // * The archived channel has no message box, so wait for the post instead
    await expect(page.getByText('Diam sapien pellentesque', {exact: false}).first()).toBeVisible();

    // # Select part of the message (the last post is the system message about archiving)
    const post = await channelsPage.centerView.getPostById(archivedPost.id);
    await selectTextWithMouse(post.body.locator('.post-message__text'), 'Diam sapien pellentesque');

    // * Verify the text is selected but no quote button is shown
    await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('Diam sapien pellentesque');
    await page.waitForTimeout(500);
    await expect(page.getByRole('button', {name: 'Quote selection'})).not.toBeVisible();
});
