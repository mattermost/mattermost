// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '@e2e-support/test_fixture';
import {createRandomPost} from '@e2e-support/server/post';

test('MM-T5435_1 Global Drafts link in sidebar should be hidden when another user deleted root post and user removes the deleted post ', async ({
    pw,
}) => {
    const {adminClient, team, adminUser, user} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Get the default channel of the team for getting the channel id
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    // # Create a post in the channel by admin
    const adminPost = await adminClient.createPost(
        createRandomPost({
            channel_id: channel.id,
            user_id: adminUser.id,
        }),
    );

    // # Log in as user in new browser context
    const {channelsPage} = await pw.testBrowser.login(user);

    // # Visit default channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    const lastPostByAdmin = await channelsPage.centerView.getLastPost();
    await lastPostByAdmin.toBeVisible();

    // # Open the last post sent by admin in RHS
    await lastPostByAdmin.hover();
    await lastPostByAdmin.postMenu.toBeVisible();
    await lastPostByAdmin.postMenu.reply();

    // # Post a message as a user
    const sidebarRight = channelsPage.sidebarRight;
    await sidebarRight.toBeVisible();
    await sidebarRight.postCreate.postMessage('Replying to a thread');

    // # Write a message in the reply thread but don't send it now so that it becomes a draft
    const draftMessageByUser = 'I should be in drafts by User';
    await sidebarRight.postCreate.writeMessage(draftMessageByUser);

    // # Close the RHS for draft to be saved
    await sidebarRight.close();

    // * Verify drafts link in channel sidebar is visible
    await channelsPage.sidebarLeft.draftsVisible();

    // # Delete the last post by admin
    try {
        await adminClient.deletePost(adminPost.id);
    } catch (error) {
        throw new Error(`Failed to delete post by admin: ${error}`);
    }

    // # Open the last post in the channel sent by admin again
    await lastPostByAdmin.body.click();

    // * Verify drafts in user's textbox is still visible
    const rhsTextboxValue = await sidebarRight.postCreate.getInputValue();
    expect(rhsTextboxValue).toBe(draftMessageByUser);

    // # Click on remove post
    const deletedPostByAdminInRHS = await sidebarRight.getPostById(adminPost.id);
    await deletedPostByAdminInRHS.remove();

    // * Verify the drafts links should also be removed from sidebar
    await channelsPage.sidebarLeft.draftsNotVisible();
});

test('MM-T5435_2 Global Drafts link in sidebar should be hidden when user deletes root post ', async ({pw}) => {
    const {user} = await pw.initSetup();

    // # Log in as user in new browser context
    const {channelsPage} = await pw.testBrowser.login(user);

    // # Visit default channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Post a message in the channel
    await channelsPage.centerView.postCreate.postMessage('Message which will be deleted');

    // # Start a thread by clicking on reply menuitem from post options menu
    const post = await channelsPage.centerView.getLastPost();
    await post.hover();
    await post.postMenu.toBeVisible();
    await post.postMenu.reply();

    const sidebarRight = channelsPage.sidebarRight;
    await sidebarRight.toBeVisible();

    // # Post a message in the thread
    await sidebarRight.postCreate.postMessage('Replying to a thread');

    // # Write a message in the reply thread but don't send it
    await sidebarRight.postCreate.writeMessage('I should be in drafts');

    // # Close the RHS for draft to be saved
    await sidebarRight.close();

    // * Verify drafts link in channel sidebar is visible
    await channelsPage.sidebarLeft.draftsVisible();

    // # Click on the dot menu of the post and select delete
    await post.hover();
    await post.postMenu.toBeVisible();
    await post.postMenu.openDotMenu();
    await channelsPage.postDotMenu.toBeVisible();
    await channelsPage.postDotMenu.deleteMenuItem.click();

    // # Confirm the delete from the modal
    await channelsPage.deletePostModal.toBeVisible();
    await channelsPage.deletePostModal.confirm();

    // * Verify drafts link in channel sidebar is visible
    await channelsPage.sidebarLeft.draftsNotVisible();
});
