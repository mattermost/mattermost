// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PreferenceType} from '@mattermost/types/preferences';

import {test, expect} from '@e2e-support/test_fixture';
import {UserProfile} from '@mattermost/types/users';
import {createRandomPost} from '@e2e-support/server/post';
import {createRandomChannel} from '@e2e-support/server';
import { Channel } from '@mattermost/types/channels';
import { Post } from '@mattermost/types/posts';

test('MM-XXX : Drafts badge doesnt get cleared when parent message is deleted and removed', async ({pw, pages}) => {
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
        adminPost = await adminClient.createPost(createRandomPost({
            channel_id: channel.id, 
            user_id: adminUser.id
        }));
    } catch (error) {
         throw new Error(`${error}: Failed to create channel or post`);
    }

    // # Log in as user in new browser context
    const {page} = await pw.testBrowser.login(user);

    // # Visit default channel page
    const userChannelPage = new pages.ChannelsPage(page);
    await userChannelPage.goto();
    await userChannelPage.toBeVisible();

    // # Open the created channel
    const lhs = userChannelPage.sidebarLeft;
    await lhs.toBeVisible();
    await lhs.goToItem(channel.name);

    // # Open the last post in the channel sent by admin
    const lastPostByAdminInUsersChannel = await userChannelPage.getLastPost();
    await lastPostByAdminInUsersChannel.openRHSWithPostOptions();

    // # Write a message as a user
    const userRHS = userChannelPage.sidebarRight;
    await userRHS.toBeVisible();
    await userRHS.postMessage('Replying to a thread');
    await userRHS.sendMessage();

    // # Write a message in the reply thread but don't send it now so that it becomes a draft
    const draftMessageByUser = 'I should be in drafts by User';
    await userRHS.postMessage(draftMessageByUser);

    // # Bring focus back to center channel textbox, so that the draft is saved
    await userChannelPage.postMessage('');

    // * Verify drafts link in channel sidebar is visible
    await userChannelPage.sidebarLeft.draftsExist();

    // # Delete the last post by admin
    try {
        await adminClient.deletePost(adminPost.id);
    } catch (error) {
        throw new Error('Failed to delete post by admin');
    }

    // * Verify drafts in user's textbox is still visible
    const rhsTextboxValue = await userRHS.getTextboxValue();
    expect(rhsTextboxValue).toBe(draftMessageByUser);

    // # Click on remove post
    const deletedPostByAdminInRHS = await userRHS.getRHSPostById(adminPost.id);
    await deletedPostByAdminInRHS.clickOnRemovePost();

    // * Verify the drafts links should also be removed from sidebar
    await userChannelPage.sidebarLeft.draftsDoesntExist();
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
