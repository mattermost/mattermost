// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {getChannelSlugFromUrl} from './helpers';

/**
 * @objective Verify that a group message can be created with a mention, closed, and then recreated with the same members.
 */
test(
    'MM-T466 creates a group message with a mention, closes it, and recreates it',
    {tag: '@direct_messages'},
    async ({pw}) => {
        // # Create the test user plus two more users on the team
        const {user, team, adminClient} = await pw.initSetup();
        const [member1, member2] = await adminClient.createUsers(team.id, 2, 'gm');

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Create a group message with the two members
        const dmModal = await channelsPage.openDirectChannelsModal();
        await dmModal.selectUser(member1);
        await dmModal.selectUser(member2);
        await dmModal.goToChannel();

        // # Post a message that mentions one of the members
        const token = `gm mention ${pw.random.id()}`;
        await channelsPage.postMessage(`@${member1.username} ${token}`);
        const lastPost = await channelsPage.getLastPost();
        await lastPost.toContainText(token);

        // # Close the group message conversation
        const slug = getChannelSlugFromUrl(page);
        await channelsPage.sidebarLeft.closeConversationAndWait(slug);

        // # Recreate the group message with the same members
        const dmModal2 = await channelsPage.openDirectChannelsModal();
        await dmModal2.selectUser(member1);
        await dmModal2.selectUser(member2);
        await dmModal2.goToChannel();

        // * Verify the same group message channel is reopened
        await expect.poll(() => page.url(), {timeout: pw.duration.ten_sec}).toContain(`/messages/${slug}`);
    },
);
