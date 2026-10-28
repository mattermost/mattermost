// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Capture snapshots of channel intro actions and channel info RHS top buttons as a
 * CSS migration baseline (before and after Compass ActionButton migration).
 */
test(
    'channel intro actions and RHS top buttons visual check',
    {tag: ['@visual', '@channel_header', '@snapshots']},
    async ({pw, browserName, viewport}, testInfo) => {
        // # Create and sign in a new user
        const {user, team} = await pw.initSetup();

        // # Log in a user in new browser context
        const {page, channelsPage} = await pw.testBrowser.login(user);

        // # Visit Town Square (fresh channel — intro and action buttons are visible)
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Stabilize dynamic content (avatars, timestamps)
        await pw.hideDynamicChannelsContent(page);

        const testArgs = {page, browserName, viewport};

        // * Snapshot the channel intro section (contains the action buttons row)
        await pw.matchSnapshot(
            {...testInfo, title: `${testInfo.title} channel intro`},
            {...testArgs, locator: channelsPage.centerView.channelIntro},
        );

        // # Open the channel info RHS
        await channelsPage.openChannelInfo();
        await expect(channelsPage.sidebarRight.channelInfoTopButtons).toBeVisible();

        // * Snapshot the RHS top buttons row
        await pw.matchSnapshot(
            {...testInfo, title: `${testInfo.title} rhs top buttons`},
            {...testArgs, locator: channelsPage.sidebarRight.channelInfoTopButtons},
        );
    },
);
