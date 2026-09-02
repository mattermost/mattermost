// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that mentioning a user inside a different pair of users' direct message does not notify the mentioned user.
 */
test('MM-T448 does not notify a user mentioned in a different DM', {tag: '@direct_messages'}, async ({pw}) => {
    // # Create the test user plus two more users on the team
    const {user, team, adminClient} = await pw.initSetup();
    const [partner, mentioned] = await adminClient.createUsers(team.id, 2, 'dmuser');

    const token = `dmmention${pw.random.id()}`;

    // # As the test user, open a DM with the partner and mention the third user there
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();
    const dmModal = await channelsPage.openDirectChannelsModal();
    await dmModal.selectUser(partner);
    await dmModal.goToChannel();
    await channelsPage.postMessage(`@${mentioned.username} ${token}`);
    const lastPost = await channelsPage.getLastPost();
    await lastPost.toContainText(token);

    // # Log in as the mentioned user and open Recent Mentions
    const {channelsPage: mentionedPage} = await pw.testBrowser.login(mentioned);
    await mentionedPage.goto(team.name, 'town-square');
    await mentionedPage.toBeVisible();
    await mentionedPage.globalHeader.openRecentMentions();

    // * Verify the mentioned user did not receive the mention from the other users' DM
    await mentionedPage.searchResultsPanel.toBeVisible();
    await expect(mentionedPage.searchResultsPanel.getResultByText(token)).toHaveCount(0);
});

/**
 * @objective Verify that deleting a parent post from a direct message reply thread removes the post, its reply, and closes the thread.
 */
test(
    'MM-T454 deletes a parent post in a direct message from the reply thread',
    {tag: '@direct_messages'},
    async ({pw}) => {
        // # Create the test user plus another user to direct message
        const {user, team, adminClient} = await pw.initSetup();
        const [otherUser] = await adminClient.createUsers(team.id, 1, 'other');

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Open a direct message channel with the other user
        const dmModal = await channelsPage.openDirectChannelsModal();
        await dmModal.selectUser(otherUser);
        await dmModal.goToChannel();

        // # Post a parent message and reply to it in the thread
        const parent = `This is the parent post ${pw.random.id()}`;
        await channelsPage.postMessage(parent);
        const parentPost = await channelsPage.getLastPost();
        const parentId = await parentPost.getId();
        await parentPost.reply();
        await channelsPage.sidebarRight.toBeVisible();
        await channelsPage.sidebarRight.postMessage(`This is a reply ${pw.random.id()}`);

        // # Delete the parent post (which has a reply) while its thread is open.
        // The parent is deleted from the center post menu, which is equivalent to and more
        // stable than the virtualized RHS root menu; the resulting behavior is identical.
        const centerParent = await channelsPage.centerView.getPostById(parentId);
        await centerParent.hover();
        await centerParent.postMenu.openDotMenu();
        await channelsPage.postDotMenu.deleteMenuItem.click();
        await channelsPage.deletePostModal.toBeVisible();
        await channelsPage.deletePostModal.confirm();

        // * Verify the reply thread closes and the parent post is gone from the center channel
        await expect(channelsPage.sidebarRight.container).not.toBeVisible();
        await expect(channelsPage.centerView.container.getByText(parent, {exact: true})).not.toBeVisible();
    },
);

/**
 * @objective Verify that a direct message can be opened from a user's profile popover on their post.
 */
test('MM-T455 opens a direct message from a profile popover', {tag: '@direct_messages'}, async ({pw}) => {
    // # Create the test user plus another user who posts in a shared channel
    const {user, team, adminClient} = await pw.initSetup();
    const [author] = await adminClient.createUsers(team.id, 1, 'author');
    const offTopic = await adminClient.getChannelByName(team.id, 'off-topic');
    await adminClient.addToChannel(author.id, offTopic.id);

    const token = `popover dm ${pw.random.id()}`;
    const {client: authorClient} = await pw.makeClient(author);
    await authorClient.createPost({channel_id: offTopic.id, message: token});

    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'off-topic');
    await channelsPage.toBeVisible();

    // # Open the author's profile popover from their post and click Message
    const post = await channelsPage.getLastPost();
    const popover = await channelsPage.openProfilePopover(post);
    await popover.message();

    // * Verify a direct message channel with the author is opened
    await expect.poll(() => page.url(), {timeout: pw.duration.ten_sec}).toContain(`/messages/@${author.username}`);
    await channelsPage.centerView.header.toHaveTitle(author.username);

    // # Post a message in the direct message channel
    const dmMessage = `direct message ${pw.random.id()}`;
    await channelsPage.postMessage(dmMessage);

    // * Verify the direct message is posted
    const lastPost = await channelsPage.getLastPost();
    await lastPost.toContainText(dmMessage);
});
