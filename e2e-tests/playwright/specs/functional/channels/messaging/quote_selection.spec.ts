// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {App, expect, test, type PlaywrightExtended, Api, settle} from '@mattermost/playwright-lib';

import {selectTextWithMouse} from './quote_selection_helpers';

const TAGS = {tag: '@messaging'};

const MESSAGE =
    'Ullamcorper eu mi, dictumst nec. Diam sapien pellentesque vestibulum pretium eget massa. Senectus ultrices tincidunt ultricies gravida.';

/** Logs the user in and opens the team's Town Square. */
async function openTownSquare(pw: PlaywrightExtended, user: UserProfile, team: Team) {
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: 'town-square'});
    return app;
}

/** The channel's last post, once the server has one with this message. */
async function lastPostWith(client: Client4, channelId: string, text: string) {
    await expect
        .poll(async () => {
            const posts = await client.getPosts(channelId);
            return posts.posts[posts.order[0]]?.message ?? '';
        })
        .toContain(text);
    const posts = await client.getPosts(channelId);
    return posts.posts[posts.order[0]];
}

/**
 * @objective Verify that text selected in a post can be quoted into the channel message box,
 * and that the quote and the reply typed below it are posted together.
 */
test('quotes text selected in a post into the channel message box', TAGS, async ({pw}) => {
    const {user, userClient, team, townSquare} = await pw.initSetup();
    const created = await userClient.createPost({channel_id: townSquare.id, message: MESSAGE});

    const app = await openTownSquare(pw, user, team);
    const post = app.center.postList.post(created);
    const quoteButton = app.quoteSelection.quoteButton;
    const {postCreate} = app.center;

    // * Verify the quote button isn't shown without a selection
    await expect(post.message.container).toBeVisible();
    await expect(quoteButton).not.toBeVisible();

    // # Select part of the message from left to right
    await selectTextWithMouse(post.message.container.locator, 'Diam sapien pellentesque');

    // # Quote the selection
    await expect(quoteButton).toBeVisible();
    await app.quoteSelection.quoteButton.click();

    // * Verify the quote is in the message box followed by an empty line, and the button is gone
    await expect(postCreate.message.container).toHaveValue('> Diam sapien pellentesque\n\n');
    await expect(postCreate.message.container).toBeFocused();
    await expect(quoteButton).not.toBeVisible();

    // # Type a reply below the quote and send it
    await app.page.keyboard.type('What do you mean?');
    await settle(postCreate.sendButton, {wait: Api.CreatePost}).click();

    // * Verify the posted message contains the quote followed by the reply
    const sent = await lastPostWith(userClient, townSquare.id, 'What do you mean?');
    const reply = app.center.postList.post(sent).message.container;
    // eslint-disable-next-line test-surface/e2e-no-literal-locators -- the blockquote is rendered markdown, which cannot take a test id; its role is what is under test
    await expect(reply.locator.getByRole('blockquote')).toHaveText('Diam sapien pellentesque');
    await expect(reply).toContainText('What do you mean?');
});

/**
 * @objective Verify that a right to left selection can be quoted too, and that a second quote is
 * added after what's already in the message box.
 */
test('adds a quote of a right to left selection after the existing draft', TAGS, async ({pw}) => {
    const {user, userClient, team, townSquare} = await pw.initSetup();
    const created = await userClient.createPost({channel_id: townSquare.id, message: MESSAGE});

    const app = await openTownSquare(pw, user, team);
    const post = app.center.postList.post(created);
    const {postCreate} = app.center;

    // # Write a draft first
    await postCreate.message.container.fill('About this:');
    await expect(postCreate.message.container).toHaveValue('About this:');

    // # Select part of the message from right to left and quote it
    await selectTextWithMouse(post.message.container.locator, 'Senectus ultrices', {backward: true});
    await app.quoteSelection.quoteButton.click();

    // * Verify the quote was added on its own after the draft
    await expect(postCreate.message.container).toHaveValue('About this:\n\n> Senectus ultrices\n\n');
});

/**
 * @objective Verify that text selected in a reply shown in the RHS is quoted into the thread's
 * reply box rather than the channel's message box.
 */
test('quotes text selected in the RHS into the thread reply box', TAGS, async ({pw}) => {
    const {user, userClient, team, townSquare} = await pw.initSetup();
    const root = await userClient.createPost({
        channel_id: townSquare.id,
        message: 'What are we doing for the logging points?',
    });
    const created = await userClient.createPost({channel_id: townSquare.id, root_id: root.id, message: MESSAGE});

    const app = await openTownSquare(pw, user, team);

    // # Open the thread in the RHS
    const rootPost = app.center.postList.post(root);
    await rootPost.container.hover();
    await rootPost.menu.replyButton.click();
    await expect(app.rhs.postCreate.message.container).toBeVisible();
    await expect(app.rhs.postCreate.message.container).toBeVisible();

    // # Select text in the reply and quote it
    const replyPost = app.rhs.thread.post(created);
    await selectTextWithMouse(replyPost.message.container.locator, 'pretium eget massa');
    await app.quoteSelection.quoteButton.click();

    // * Verify the quote went into the thread reply box and not the channel message box
    await expect(app.rhs.postCreate.message.container).toHaveValue('> pretium eget massa\n\n');
    await expect(app.center.postCreate.message.container).toHaveValue('');
});

/**
 * @objective Verify that quoting formatted text keeps its Markdown formatting, such as headings,
 * lists, code blocks and links.
 */
test('keeps the Markdown formatting of the quoted text', TAGS, async ({pw}) => {
    const {user, userClient, team, townSquare} = await pw.initSetup();
    const created = await userClient.createPost({
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

    const app = await openTownSquare(pw, user, team);

    // # Select the whole message and quote it
    const post = app.center.postList.post(created);
    await selectTextWithMouse(post.message.container.locator, 'Project Update', {untilPhrase: 'dashboard'});
    await app.quoteSelection.quoteButton.click();

    // * Verify the quote keeps the heading, emphasis, list, code block and link
    await expect(app.center.postCreate.message.container).toHaveValue(
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
    const {user, userClient, team, townSquare} = await pw.initSetup();
    const created = await userClient.createPost({channel_id: townSquare.id, message: MESSAGE});

    const app = await openTownSquare(pw, user, team);

    // # Select part of the message
    const post = app.center.postList.post(created);
    await selectTextWithMouse(post.message.container.locator, 'Diam sapien pellentesque');
    const quoteButton = app.quoteSelection.quoteButton;
    await expect(quoteButton).toBeVisible();

    // # Move to the quote button with Tab and press Enter
    await app.page.keyboard.press('Tab');
    await expect(quoteButton).toBeFocused();
    await app.page.keyboard.press('Enter');

    // * Verify the quote is in the message box
    await expect(app.center.postCreate.message.container).toHaveValue('> Diam sapien pellentesque\n\n');
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

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});

    // * The archived channel has no message box, so wait for the post instead
    const post = app.center.postList.post(archivedPost);
    await expect(post.message.container).toContainText('Diam sapien pellentesque');

    // # Select part of the message (the last post is the system message about archiving)
    await selectTextWithMouse(post.message.container.locator, 'Diam sapien pellentesque');

    // * Verify the text is selected but no quote button is shown
    await expect
        .poll(() => app.page.evaluate(() => window.getSelection()?.toString()))
        .toBe('Diam sapien pellentesque');

    // The button decides whether to show in a zero-delay timer after mouseup: let the page render two
    // frames, so that decision has been made and rendered before checking the button stays hidden.
    await app.page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)))),
    );
    await expect(app.quoteSelection.quoteButton).not.toBeVisible();
});

/**
 * @objective Verify that text can be quoted in a channel opened in a pop-out window.
 */
test('quotes text selected in a channel pop-out window', TAGS, async ({pw}) => {
    const {user, userClient, team, townSquare} = await pw.initSetup();
    const post = await userClient.createPost({channel_id: townSquare.id, message: MESSAGE});

    const app = await openTownSquare(pw, user, team);

    // # Open the channel in a pop-out window
    const [popoutPage] = await Promise.all([app.page.waitForEvent('popup'), app.channelHeader.popoutButton.click()]);
    const popout = new App(popoutPage);
    const message = popout.center.postList.post(post).message.container.locator;
    await expect(message).toBeVisible();

    // # Select part of the message and quote it
    await selectTextWithMouse(message, 'Diam sapien pellentesque');
    await popout.quoteSelection.quoteButton.click();

    // * Verify the quote is in the pop-out's message box
    await expect(popout.center.postCreate.message.container).toHaveValue('> Diam sapien pellentesque\n\n');
});
