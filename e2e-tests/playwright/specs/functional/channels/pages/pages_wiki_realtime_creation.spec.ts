// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';
import {
    createWikiThroughUI,
    createTestUserInChannel,
    WEBSOCKET_WAIT,
    HIERARCHY_TIMEOUT,
    ELEMENT_TIMEOUT,
} from './test_helpers';

/**
 * @objective Verify wiki tab appears in channel bar for other users when wiki is created
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 * Two users have access to the same channel
 */
test(
    'shows wiki tab in channel bar for other users when wiki is created (real-time)',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user: user1, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // # Create user2 and add to channel
        const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

        // # User 2 logs in and navigates to the channel FIRST (to establish viewing state)
        const {page: user2Page, channelsPage: channelsPage2} = await pw.testBrowser.login(user2);
        await channelsPage2.goto(team.name, channel.name);
        await channelsPage2.toBeVisible();

        // # Wait for channel to fully load
        await user2Page.waitForLoadState('networkidle');

        // # Verify user2 is in the channel and channel tabs are visible
        const channelTabsContainer = user2Page.locator('.channel-tabs-container');
        await expect(channelTabsContainer).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Generate unique wiki name
        const wikiName = `Wiki RT Test ${await pw.random.id()}`;

        // # Verify no wiki tab with this name exists yet for user2
        const wikiTabSelector = user2Page
            .locator('.channel-tabs-container__tab-wrapper--wiki')
            .filter({hasText: wikiName});
        await expect(wikiTabSelector).not.toBeVisible();

        // # User 1 logs in and navigates to the same channel
        const {page: page1, channelsPage: channelsPage1} = await pw.testBrowser.login(user1);
        await channelsPage1.goto(team.name, channel.name);
        await channelsPage1.toBeVisible();

        // # User 1 creates a wiki
        await createWikiThroughUI(page1, wikiName);

        // * Verify user1 sees the wiki tab (sanity check)
        const user1WikiTab = page1.locator('.channel-tabs-container__tab-wrapper--wiki').filter({hasText: wikiName});
        await expect(user1WikiTab).toBeVisible({timeout: HIERARCHY_TIMEOUT});

        // * CRITICAL: Verify user2 sees the wiki tab appear WITHOUT refresh (real-time via WebSocket)
        await user2Page.waitForTimeout(WEBSOCKET_WAIT);
        await expect(wikiTabSelector).toBeVisible({timeout: HIERARCHY_TIMEOUT});

        // # Cleanup: close pages
        await page1.close();
        await user2Page.close();
    },
);

/**
 * @objective Verify multiple wiki tabs appear for other users as wikis are created
 *
 * This extended test verifies that the real-time update works for multiple wiki creations,
 * not just the first one.
 */
test(
    'shows multiple wiki tabs in channel bar for other users as wikis are created (real-time)',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user: user1, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // # Create user2 and add to channel
        const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

        // # User 2 logs in and navigates to the channel
        const {page: user2Page, channelsPage: channelsPage2} = await pw.testBrowser.login(user2);
        await channelsPage2.goto(team.name, channel.name);
        await channelsPage2.toBeVisible();
        await user2Page.waitForLoadState('networkidle');

        // # User 1 logs in
        const {page: page1, channelsPage: channelsPage1} = await pw.testBrowser.login(user1);
        await channelsPage1.goto(team.name, channel.name);
        await channelsPage1.toBeVisible();

        // # User 1 creates first wiki
        const wiki1Name = `Wiki A ${await pw.random.id()}`;
        await createWikiThroughUI(page1, wiki1Name);

        // * Verify user2 sees first wiki tab (real-time)
        await user2Page.waitForTimeout(WEBSOCKET_WAIT);
        const wiki1Tab = user2Page.locator('.channel-tabs-container__tab-wrapper--wiki').filter({hasText: wiki1Name});
        await expect(wiki1Tab).toBeVisible({timeout: HIERARCHY_TIMEOUT});

        // # User 1 navigates back to channel and creates second wiki
        await channelsPage1.goto(team.name, channel.name);
        const wiki2Name = `Wiki B ${await pw.random.id()}`;
        await createWikiThroughUI(page1, wiki2Name);

        // * Verify user2 sees second wiki tab (real-time)
        await user2Page.waitForTimeout(WEBSOCKET_WAIT);
        const wiki2Tab = user2Page.locator('.channel-tabs-container__tab-wrapper--wiki').filter({hasText: wiki2Name});
        await expect(wiki2Tab).toBeVisible({timeout: HIERARCHY_TIMEOUT});

        // * Verify both tabs are still visible
        await expect(wiki1Tab).toBeVisible();
        await expect(wiki2Tab).toBeVisible();

        // # Cleanup
        await page1.close();
        await user2Page.close();
    },
);
