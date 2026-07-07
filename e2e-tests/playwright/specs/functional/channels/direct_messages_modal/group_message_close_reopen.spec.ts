// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that a closed group message can be reopened via a saved message and via the Direct Messages modal.
 */
test(
    'MM-T476 closes and reopens a group message via saved messages and the DM modal',
    {tag: '@direct_messages'},
    async ({pw}) => {
        // # Create the test user plus two more users on the team
        const {user, team, adminClient, userClient} = await pw.initSetup();
        const member1 = await pw.createNewUserProfile(adminClient, {prefix: 'gmx'});
        const member2 = await pw.createNewUserProfile(adminClient, {prefix: 'gmy'});
        await adminClient.addToTeam(team.id, member1.id);
        await adminClient.addToTeam(team.id, member2.id);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Create a group message and post a message, then save that message
        const dmModal = await channelsPage.openDirectChannelsModal();
        await dmModal.selectUser(member1);
        await dmModal.selectUser(member2);
        await dmModal.goToChannel();
        const slug = new URL(page.url()).pathname.split('/').pop() as string;

        const token = `message to save ${pw.random.id()}`;
        await channelsPage.postMessage(token);
        const savedPost = await channelsPage.getLastPost();
        const savedPostId = await savedPost.getId();
        await userClient.savePreferences(user.id, [
            {user_id: user.id, category: 'flagged_post', name: savedPostId, value: 'true'},
        ]);

        // # Close the group message conversation
        await channelsPage.sidebarLeft.closeConversation(slug);
        await expect(page.locator(`#sidebarItem_${slug}`)).not.toBeVisible();

        // # Reopen the group message by jumping to the saved message
        await channelsPage.globalHeader.openSavedMessages();
        await channelsPage.searchResultsPanel.toBeVisible();
        await channelsPage.searchResultsPanel.toContainText(token);
        await channelsPage.searchResultsPanel.jumpToResultWithText(token);

        // * Verify the group message channel is reopened
        await expect.poll(() => page.url(), {timeout: pw.duration.ten_sec}).toContain(`/messages/${slug}`);

        // # Close it again and reopen it via the Direct Messages modal
        await channelsPage.sidebarLeft.closeConversation(slug);
        await expect(page.locator(`#sidebarItem_${slug}`)).not.toBeVisible();
        const dmModal2 = await channelsPage.openDirectChannelsModal();
        await dmModal2.selectUser(member1);
        await dmModal2.selectUser(member2);
        await dmModal2.goToChannel();

        // * Verify the group message channel is reopened again
        await expect.poll(() => page.url(), {timeout: pw.duration.ten_sec}).toContain(`/messages/${slug}`);
    },
);
