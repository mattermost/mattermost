// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@playwright/test';
import {v4 as uuidv4} from 'uuid';

import {initSetup} from '@e2e-support/server';
import {ChannelsPage} from '@e2e-support/ui/pages';
import {getRandomId} from '@e2e-support/util';

test.describe('Notifications', () => {
    let channelsPage: ChannelsPage;
    let otherUser: any;
    let offTopicChannelId: string;
    let teamName: string;
    const numberOfPosts = 30;

    test.beforeAll(async ({browser}) => {
        const {team, user, adminClient} = await initSetup();
        otherUser = user;
        teamName = team.name;

        // Get off-topic channel
        const channel = await adminClient.getChannelByName(teamName, 'off-topic');
        offTopicChannelId = channel.id;
    });

    test.beforeEach(async ({page}) => {
        channelsPage = new ChannelsPage(page);
        await channelsPage.goto();
        await channelsPage.toBeVisible();
        
        // Navigate to off-topic channel
        await channelsPage.sidebarLeft.goToChannel('off-topic');
    });

    test('MM-T562 New message bar - Message posted while scrolled up in same channel', async ({page}) => {
        // # Post 30 random messages from the 'otherUser' account in off-topic
        for (let i = 0; i < numberOfPosts; i++) {
            await channelsPage.apiClient.createPost({
                channel_id: offTopicChannelId,
                message: `${i} ${getRandomId()}`,
            }, otherUser.id);
        }

        // # Reload to ensure all posts are loaded
        await page.reload();
        await channelsPage.toBeVisible();

        // # Scroll to the top of the channel so that the 'Jump to New Messages' button would be visible
        await page.locator('.post-list__dynamic').scrollIntoViewIfNeeded();
        await page.locator('.post-list__dynamic').evaluate(el => el.scrollTop = 0);

        // # Post two new messages as 'otherUser'
        await channelsPage.apiClient.createPost({
            channel_id: offTopicChannelId,
            message: 'Random Message',
        }, otherUser.id);
        
        await channelsPage.apiClient.createPost({
            channel_id: offTopicChannelId,
            message: 'Last Message',
        }, otherUser.id);

        // * Verify that the last message is currently not visible
        await expect(page.getByText('Last Message')).not.toBeVisible();

        // * Verify that 'Jump to New Messages' button is visible
        const jumpToNewMessagesButton = page.locator('.toast__visible');
        await expect(jumpToNewMessagesButton).toBeVisible();

        // # Click on the 'Jump to New Messages' button
        await jumpToNewMessagesButton.click();

        // * Verify that the last message is now visible
        await expect(page.getByText('Last Message')).toBeVisible();

        // * Verify that 'Jump to New Messages' is not visible
        await expect(jumpToNewMessagesButton).not.toBeVisible();
    });
});
