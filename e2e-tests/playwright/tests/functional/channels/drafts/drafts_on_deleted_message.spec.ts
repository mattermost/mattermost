// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PreferenceType} from '@mattermost/types/preferences';
import {Channel} from '@mattermost/types/channels';
import {UserProfile} from '@mattermost/types/users';
import {Post} from '@mattermost/types/posts';

import {test, expect} from '@e2e-support/test_fixture';
import {createRandomPost} from '@e2e-support/server/post';
import {createRandomChannel} from '@e2e-support/server';

test('MM-T5435_1 Gloabl Drafts link in sidebar should be hidden when another user deleted root post and user removes the deleted post ', async ({
    pw,
    pages,
}) => {
    const {adminClient, team, adminUser, user, userClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    try {
        // # Set preferences to disable tooltips for drafts and threads
        await userClient.savePreferences(user.id, createNoTooltipForDraftsAndThreadsPreferences(user.id));
        await adminClient.savePreferences(adminUser.id, createNoTooltipForDraftsAndThreadsPreferences(adminUser.id));
    } catch (error) {
        throw new Error('Failed to set preferences');
    }

    let channel: Channel;
    let adminPost: Post;
    try {
        // # Create a new channel
        channel = await adminClient.createChannel(
            createRandomChannel({
                teamId: team.id,
                name: 'test_channel',
                displayName: 'Test Channel',
                unique: true,
            })
        );

        // # Add admin and user to the channel
        await userClient.addToChannel(user.id, channel.id);
        await adminClient.addToChannel(adminUser.id, channel.id);

        // # Create a post in the channel by admin
        adminPost = await adminClient.createPost(
            createRandomPost({
                channel_id: channel.id,
                user_id: adminUser.id,
            })
        );
    } catch (error) {
        throw new Error(`${error}: Failed to create channel or post`);
    }

    // # Log in as user in new browser context
    const {page} = await pw.testBrowser.login(user);

    // # Visit default channel page
    const channelPage = new pages.ChannelsPage(page);
    await channelPage.goto(team.name);
    await channelPage.toBeVisible();

    // # Open the created channel
    const sidebarLeft = channelPage.sidebarLeft;
    await sidebarLeft.toBeVisible();
    await sidebarLeft.goToItem(channel.name);

    // # Open the last post in the channel sent by admin
    const lastPostByAdminInChannel = await channelPage.getLastPost();
    await lastPostByAdminInChannel.openRHSWithPostOptions();

    // # Write a message as a user
    const sidebarRight = channelPage.sidebarRight;
    await sidebarRight.toBeVisible();
    await sidebarRight.postMessage('Replying to a thread');
    await sidebarRight.sendMessage();

    // # Write a message in the reply thread but don't send it now so that it becomes a draft
    const draftMessageByUser = 'I should be in drafts by User';
    await sidebarRight.postMessage(draftMessageByUser);

    // # Bring focus back to center channel textbox, so that the draft is saved
    await channelPage.postMessage('');

    // * Verify drafts link in channel sidebar is visible
    await channelPage.sidebarLeft.draftsExist();

    // # Delete the last post by admin
    try {
        await adminClient.deletePost(adminPost.id);
    } catch (error) {
        throw new Error('Failed to delete post by admin');
    }

    // * Verify drafts in user's textbox is still visible
    const rhsTextboxValue = await sidebarRight.getTextboxValue();
    expect(rhsTextboxValue).toBe(draftMessageByUser);

    // # Click on remove post
    const deletedPostByAdminInRHS = await sidebarRight.getRHSPostById(adminPost.id);
    await deletedPostByAdminInRHS.clickOnRemovePost();

    // * Verify the drafts links should also be removed from sidebar
    await channelPage.sidebarLeft.draftsDoesntExist();
});

test('MM-T5435_2 Gloabl Drafts link in sidebar should be hidden when user deletes root post ', async ({pw, pages}) => {
    const {team, user, userClient} = await pw.initSetup();

    try {
        // # Set preferences to disable tooltips for drafts and threads
        await userClient.savePreferences(user.id, createNoTooltipForDraftsAndThreadsPreferences(user.id));
    } catch (error) {
        throw new Error('Failed to set preferences');
    }

    // # Log in as user in new browser context
    const {page} = await pw.testBrowser.login(user);

    // # Visit default channel page
    const channelPage = new pages.ChannelsPage(page);
    await channelPage.goto(team.name);
    await channelPage.toBeVisible();

    // # Post a message in the channel
    await channelPage.postMessage('Message which will be deleted');
    await channelPage.sendMessage();

    // # Start a thread by clicking on reply button
    const lastPost = await channelPage.getLastPost();
    await lastPost.openRHSWithPostOptions();

    const sidebarRight = channelPage.sidebarRight;
    await sidebarRight.toBeVisible();

    // # Write a message in the thread
    await sidebarRight.postMessage('Replying to a thread');
    await sidebarRight.sendMessage();

    // # Write a message in the reply thread but don't send it
    await sidebarRight.postMessage('I should be in drafts');

    // # Bring focus back to center channel textbox, so that the draft in RHS is saved
    await channelPage.postMessage('');

    // * Verify drafts link in channel sidebar is visible
    await channelPage.sidebarLeft.draftsExist();

    // # Delete the last post with post options
    await lastPost.openPostActionsMenu();
    const postOptionsMenuOnLastPost = channelPage.postActionMenu;
    await postOptionsMenuOnLastPost.toBeVisible();
    await postOptionsMenuOnLastPost.click('Delete', true);
    const deletePostModal = channelPage.deletePostModal;
    await deletePostModal.toBeVisible();
    await deletePostModal.confirmClick();

    // * Verify drafts link in channel sidebar is visible
    await channelPage.sidebarLeft.draftsDoesntExist();
});

function createNoTooltipForDraftsAndThreadsPreferences(userId: UserProfile['id']): PreferenceType[] {
    return [
        {
            category: 'drafts',
            name: 'drafts_tour_tip_showed',
            user_id: userId,
            value: JSON.stringify({drafts_tour_tip_showed: true}),
        },
        {
            user_id: userId,
            category: 'crt_thread_pane_step',
            name: userId,
            value: '999',
        },
    ];
}
