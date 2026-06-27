// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {createPost, createPublicChannel, createUsers, expectSidebarUnread} from '../rfqa_helpers';

/**
 * @objective Verify disabling "Ignore mentions" counts @channel, @here, and @all as mentions.
 */
test(
    'MM-T568 Channel Notifications turn off Ignore mentions for @channel, @here and @all',
    {tag: '@rfqa'},
    async ({pw}) => {
        const {adminClient, team, user} = await pw.initSetup();
        const [sender] = await createUsers(pw, adminClient, team, 1, 'rfqa-channel-mentions');
        const channelA = await createPublicChannel(pw, adminClient, team, 'RFQA Mention Source');
        const channelB = await createPublicChannel(pw, adminClient, team, 'RFQA Mention Away');
        await adminClient.addToChannel(user.id, channelA.id);
        await adminClient.addToChannel(user.id, channelB.id);
        await adminClient.addToChannel(sender.id, channelA.id);

        // # Open channel notification preferences and turn off ignore mentions
        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channelA.name);
        await channelsPage.toBeVisible();
        await channelsPage.centerView.header.openChannelMenu();
        await page.getByRole('menuitem', {name: 'Notification Preferences'}).click();
        await page.getByText('Mute or ignore').waitFor();
        const ignoreMentions = page.getByRole('checkbox', {name: 'Ignore mentions for @channel, @here and @all'});
        if (await ignoreMentions.isChecked()) {
            await ignoreMentions.uncheck();
        }
        await page.getByRole('button', {name: 'Save'}).click();

        // # Move away and post each channel-wide mention from another user
        await channelsPage.goto(team.name, channelB.name);
        await createPost(adminClient, sender, channelA, '@all test');
        await createPost(adminClient, sender, channelA, '@channel test');
        await createPost(adminClient, sender, channelA, '@here test');

        // * Verify the channel is unread and counts channel-wide mentions
        await expectSidebarUnread(channelsPage, channelA.name);
        await expect(page.locator(`#sidebarItem_${channelA.name} #unreadMentions`)).toHaveText(/[23]/);
    },
);
