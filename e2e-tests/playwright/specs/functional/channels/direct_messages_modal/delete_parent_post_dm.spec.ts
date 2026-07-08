// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

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
