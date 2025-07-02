// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test('MM-T5424 Find channel search returns only 50 results when there are more than 50 channels with similar names', async ({
    pw,
}) => {
    const {adminClient, user, team} = await pw.initSetup();

    const commonName = 'test_channel';

    // # Create more than 50 channels with similar names
    const channelsRes = [];
    for (let i = 0; i < 100; i++) {
        let suffix = i.toString();
        if (i < 10) {
            suffix = `0${i}`;
        }
        const channel = pw.random.channel({
            teamId: team.id,
            name: `${commonName}_${suffix}`,
            displayName: `Test Channel ${suffix}`,
        });
        channelsRes.push(adminClient.createChannel(channel));
    }
    await Promise.all(channelsRes);

    // # Log in a user in new browser context
    const {channelsPage} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Click on "Find channel" and type "test_channel"
    await channelsPage.sidebarLeft.findChannelButton.click();

    await channelsPage.findChannelsModal.toBeVisible();
    await channelsPage.findChannelsModal.input.fill(commonName);

    const limitCount = 50;

    // # Only 50 results for similar name should be displayed.
    await expect(channelsPage.findChannelsModal.searchList).toHaveCount(limitCount);

    for (let i = 0; i < limitCount; i++) {
        let suffix = i.toString();
        if (i < 10) {
            suffix = `0${i}`;
        }

        await expect(channelsPage.findChannelsModal.container.getByTestId(`${commonName}_${suffix}`)).toBeVisible();
    }
});
