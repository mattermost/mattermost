// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that Find channel search limits results to 50 when there are more channels matching the search query
 *
 * The switcher is checked through the generated page objects: its results are keyed by channel id.
 */
test(
    'MM-T5424 Find channel search returns only 50 results when there are more than 50 channels with similar names',
    {tag: '@smoke'},
    async ({pw}) => {
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
        const created = await Promise.all(channelsRes);

        // # Log in a user in new browser context
        const {app} = await pw.testBrowser.login(user);

        // # Visit a default channel page
        await app.teamPage.goto({team});
        await expect(app.center.composer).toBeVisible();

        // # Click on "Find channel" and type "test_channel"
        await app.lhs.header.findChannelsButton.clickTo(app.quickSwitchModal);
        const switcher = app.quickSwitchModal;
        await switcher.searchTextbox.fill(commonName);

        const limitCount = 50;

        // * Verify only 50 results for similar name are displayed
        await expect(switcher.suggestions.suggestionList).toHaveKeyCount(limitCount);

        // * Verify the first 50 channels (by name) are the results; results are keyed by channel id
        const first = created.sort((a, b) => a.name.localeCompare(b.name)).slice(0, limitCount);
        for (const channel of first) {
            await expect(switcher.suggestions.suggestion(channel.id)).toBeVisible();
        }
    },
);
