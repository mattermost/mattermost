// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {getChannelSlugFromUrl} from './helpers';

/**
 * @objective Verify that a closed group message can be reopened via a saved message and via the Direct Messages modal.
 *
 * MM-T477 and MM-T479 are duplicates of MM-T476 (all map to Rainforest RF-MTD188) and are covered by this test.
 */
test(
    'MM-T476 MM-T477 MM-T479 closes and reopens a group message via saved messages and the DM modal',
    {tag: '@direct_messages'},
    async ({pw}) => {
        // # Create the test user plus two more users on the team
        const {user, team, adminClient, userClient} = await pw.initSetup();
        const [member1, member2] = await adminClient.createUsers(team.id, 2, 'gm');

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Create a group message and post a message, then save that message
        const dmModal = await channelsPage.openDirectChannelsModal();
        await dmModal.selectUser(member1);
        await dmModal.selectUser(member2);
        await dmModal.goToChannel();
        const slug = getChannelSlugFromUrl(page);

        const token = `message to save ${pw.random.id()}`;
        await channelsPage.postMessage(token);
        const savedPost = await channelsPage.getLastPost();
        const savedPostId = await savedPost.getId();
        await userClient.savePreferences(user.id, [
            {user_id: user.id, category: 'flagged_post', name: savedPostId, value: 'true'},
        ]);

        // # Close the group message conversation
        await channelsPage.sidebarLeft.closeConversationAndWait(slug);

        // # Reopen the group message by jumping to the saved message
        await channelsPage.globalHeader.openSavedMessages();
        await channelsPage.searchResultsPanel.toBeVisible();
        await channelsPage.searchResultsPanel.toContainText(token);
        await channelsPage.searchResultsPanel.jumpToResultWithText(token);

        // * Verify the group message channel is reopened
        await expect.poll(() => page.url(), {timeout: pw.duration.ten_sec}).toContain(`/messages/${slug}`);

        // # Close it again and reopen it via the Direct Messages modal
        await channelsPage.sidebarLeft.closeConversationAndWait(slug);
        const dmModal2 = await channelsPage.openDirectChannelsModal();
        await dmModal2.selectUser(member1);
        await dmModal2.selectUser(member2);
        await dmModal2.goToChannel();

        // * Verify the group message channel is reopened again
        await expect.poll(() => page.url(), {timeout: pw.duration.ten_sec}).toContain(`/messages/${slug}`);
    },
);
