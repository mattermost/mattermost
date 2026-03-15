// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that opening a thread popout creates a new window with the correct URL and thread content
 */
test('thread popout opens in a new window with correct URL and content', {tag: ['@threads', '@ai-assisted']}, async ({pw}) => {
    const {adminClient, user, team} = await pw.initSetup();

    // # Create a channel with a threaded conversation
    const channel = await adminClient.createChannel(
        pw.random.channel({
            teamId: team.id,
            displayName: 'Thread Popout Channel',
            name: 'thread-popout-channel',
        }),
    );
    await adminClient.addToChannel(user.id, channel.id);

    const rootMessage = `thread-popout-root-${await pw.random.id()}`;
    const rootPost = await adminClient.createPost({
        channel_id: channel.id,
        message: rootMessage,
    });

    const replyMessage = `thread-popout-reply-${await pw.random.id()}`;
    await adminClient.createPost({
        channel_id: channel.id,
        message: replyMessage,
        root_id: rootPost.id,
    });

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    const page = channelsPage.page;

    // # Open thread in RHS by clicking the reply count
    const centerPost = await channelsPage.centerView.getPostById(rootPost.id);
    await centerPost.container.getByRole('button', {name: /reply/i}).click();

    await channelsPage.sidebarRight.toBeVisible();

    // # Click "Open in new window" button in RHS header
    const popoutButton = channelsPage.sidebarRight.container.getByRole('button', {name: 'Open in new window'});
    const [popoutPage] = await Promise.all([page.waitForEvent('popup'), popoutButton.click()]);

    await popoutPage.waitForLoadState('domcontentloaded');

    // * Verify popout URL contains the thread path and root post ID
    const popoutUrl = popoutPage.url();
    expect(popoutUrl).toContain('/_popout/thread/');
    expect(popoutUrl).toContain(rootPost.id);

    // * Verify popout title
    await expect(popoutPage).toHaveTitle(/Thread.*Mattermost/);

    // * Verify thread content is visible in popout
    await expect(popoutPage.getByText(rootMessage)).toBeVisible();
    await expect(popoutPage.getByText(replyMessage)).toBeVisible();

    // * Verify reply input is available
    await expect(popoutPage.getByRole('textbox', {name: 'Reply to this thread...'})).toBeVisible();

    await popoutPage.close();
});

/**
 * @objective Verify that a thread popout loads all replies correctly when there are multiple
 */
test('thread popout loads all replies correctly', {tag: ['@threads', '@ai-assisted']}, async ({pw}) => {
    const {adminClient, user, team} = await pw.initSetup();

    const channel = await adminClient.createChannel(
        pw.random.channel({
            teamId: team.id,
            displayName: 'Thread Popout Replies Channel',
            name: 'thread-popout-replies-channel',
        }),
    );
    await adminClient.addToChannel(user.id, channel.id);

    const rootPost = await adminClient.createPost({
        channel_id: channel.id,
        message: `root-${await pw.random.id()}`,
    });

    // # Create multiple replies
    const replies: string[] = [];
    for (let i = 1; i <= 5; i++) {
        const replyText = `reply-${i}-${await pw.random.id()}`;
        replies.push(replyText);
        await adminClient.createPost({
            channel_id: channel.id,
            message: replyText,
            root_id: rootPost.id,
        });
    }

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    const page = channelsPage.page;

    // # Open thread in RHS
    const centerPost = await channelsPage.centerView.getPostById(rootPost.id);
    await centerPost.container.getByRole('button', {name: /reply/i}).click();

    await channelsPage.sidebarRight.toBeVisible();

    // # Open popout
    const popoutButton = channelsPage.sidebarRight.container.getByRole('button', {name: 'Open in new window'});
    const [popoutPage] = await Promise.all([page.waitForEvent('popup'), popoutButton.click()]);

    await popoutPage.waitForLoadState('domcontentloaded');

    // * Verify all replies are visible
    for (const replyText of replies) {
        await expect(popoutPage.getByText(replyText)).toBeVisible();
    }

    // * Verify reply count
    await expect(popoutPage.getByText(`${replies.length} replies`)).toBeVisible();

    await popoutPage.close();
});

/**
 * @objective Verify that a reply posted in the thread popout appears in the original thread RHS
 */
test('reply posted in thread popout appears in the thread', {tag: ['@threads', '@ai-assisted']}, async ({pw}) => {
    const {adminClient, user, team} = await pw.initSetup();

    const channel = await adminClient.createChannel(
        pw.random.channel({
            teamId: team.id,
            displayName: 'Thread Popout Reply Channel',
            name: 'thread-popout-reply-channel',
        }),
    );
    await adminClient.addToChannel(user.id, channel.id);

    const rootPost = await adminClient.createPost({
        channel_id: channel.id,
        message: `root-${await pw.random.id()}`,
    });

    await adminClient.createPost({
        channel_id: channel.id,
        message: `initial-reply-${await pw.random.id()}`,
        root_id: rootPost.id,
    });

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    const page = channelsPage.page;

    // # Open thread in RHS
    const centerPost = await channelsPage.centerView.getPostById(rootPost.id);
    await centerPost.container.getByRole('button', {name: /reply/i}).click();

    await channelsPage.sidebarRight.toBeVisible();

    // # Open popout
    const popoutButton = channelsPage.sidebarRight.container.getByRole('button', {name: 'Open in new window'});
    const [popoutPage] = await Promise.all([page.waitForEvent('popup'), popoutButton.click()]);

    await popoutPage.waitForLoadState('domcontentloaded');

    // # Type and send a reply in the popout
    const popoutReply = `popout-reply-${await pw.random.id()}`;
    const replyInput = popoutPage.getByRole('textbox', {name: 'Reply to this thread...'});
    await replyInput.click();
    await replyInput.fill(popoutReply);

    const sendButton = popoutPage.getByRole('button', {name: 'Send Now'});
    await sendButton.click();

    // * Verify the reply appears in the popout
    await expect(popoutPage.getByText(popoutReply)).toBeVisible();

    // * Verify the reply also appears in the original thread RHS
    await expect(channelsPage.sidebarRight.container.getByText(popoutReply)).toBeVisible();

    await popoutPage.close();
});

/**
 * @objective Verify that the thread popout displays Follow button and channel link in the header
 */
test('thread popout shows Following button and channel link', {tag: ['@threads', '@ai-assisted']}, async ({pw}) => {
    const {adminClient, user, team} = await pw.initSetup();

    const channel = await adminClient.createChannel(
        pw.random.channel({
            teamId: team.id,
            displayName: 'Thread Popout UI Channel',
            name: 'thread-popout-ui-channel',
        }),
    );
    await adminClient.addToChannel(user.id, channel.id);

    const rootPost = await adminClient.createPost({
        channel_id: channel.id,
        message: `root-${await pw.random.id()}`,
    });

    await adminClient.createPost({
        channel_id: channel.id,
        message: `reply-${await pw.random.id()}`,
        root_id: rootPost.id,
    });

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    const page = channelsPage.page;

    // # Open thread in RHS
    const centerPost = await channelsPage.centerView.getPostById(rootPost.id);
    await centerPost.container.getByRole('button', {name: /reply/i}).click();

    await channelsPage.sidebarRight.toBeVisible();

    // # Open popout
    const popoutButton = channelsPage.sidebarRight.container.getByRole('button', {name: 'Open in new window'});
    const [popoutPage] = await Promise.all([page.waitForEvent('popup'), popoutButton.click()]);

    await popoutPage.waitForLoadState('domcontentloaded');

    // * Verify Follow button is present
    await expect(popoutPage.getByText('Follow', {exact: true})).toBeVisible();

    // * Verify the channel name is displayed as a link in the popout header
    await expect(popoutPage.getByRole('link', {name: channel.display_name})).toBeVisible();

    // * Verify header shows "Thread" label
    await expect(popoutPage.getByText('Thread', {exact: true}).first()).toBeVisible();

    await popoutPage.close();
});
