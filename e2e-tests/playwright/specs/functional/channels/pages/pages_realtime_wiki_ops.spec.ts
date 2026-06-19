// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';
import {
    createWikiThroughUI,
    createTestChannel,
    createTestUserInChannel,
    renameWikiThroughModal,
    linkWikiToChannel,
    unlinkWikiFromChannelThroughUI,
    getWikiTab,
    setupWebSocketEventLogging,
    waitForWikiTab,
    uniqueName,
    loginAndNavigateToChannel,
    ELEMENT_TIMEOUT,
    HIERARCHY_TIMEOUT,
} from './test_helpers';

/**
 * @objective Verify wiki tab name updates in real-time for other users when wiki is renamed
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 * Two users have access to the same channel
 */
test(
    'updates wiki tab name in real-time for other users when wiki is renamed',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user: user1, adminClient} = sharedPagesSetup;

        // Use a freshly-created channel (not town-square) to isolate this test from
        // accumulated wiki/page state left behind by earlier tests in the suite.
        const channel = await createTestChannel(adminClient, team.id, 'Rename Wiki Channel', 'O', [user1.id]);

        // # User 1 creates wiki
        const {page: page1, channelsPage: channelsPage1} = await loginAndNavigateToChannel(
            pw,
            user1,
            team.name,
            channel.name,
        );

        const originalWikiName = uniqueName('Original Wiki');
        await createWikiThroughUI(page1, originalWikiName);

        // # Navigate back to channel view
        await channelsPage1.goto(team.name, channel.name);
        await channelsPage1.toBeVisible();

        // # Create user2 and add to channel
        const {user: user2} = await createTestUserInChannel(pw, adminClient, team, channel, 'user2');

        // # User 2 logs in and navigates to channel (should see wiki tab)
        const {page: user2Page} = await loginAndNavigateToChannel(pw, user2, team.name, channel.name);

        // * Verify wiki tab is visible for user2 with original name
        const originalWikiTab = getWikiTab(user2Page, originalWikiName);
        await expect(originalWikiTab).toBeVisible({timeout: HIERARCHY_TIMEOUT});

        // # Setup WebSocket event logging for user2
        await setupWebSocketEventLogging(user2Page);

        // # User 1 renames the wiki via tab menu
        const newWikiName = uniqueName('Renamed Wiki');
        await waitForWikiTab(page1, originalWikiName);
        await renameWikiThroughModal(page1, originalWikiName, newWikiName);

        // * Verify rename succeeded for user1
        await expect(getWikiTab(page1, newWikiName)).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // * Verify wiki tab shows new name for user2 (real-time without refresh)
        const renamedWikiTab = getWikiTab(user2Page, newWikiName);
        await expect(renamedWikiTab).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // * Verify old name tab is gone
        await expect(originalWikiTab).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

        await user2Page.close();
    },
);

/**
 * @objective Verify wiki tab appears in real-time for other users when wiki is linked to their channel
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 * Wiki exists in a source channel; target channel is separate
 */
test(
    'adds wiki tab in real-time for other users when wiki is linked to their channel',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user: user1, adminClient} = sharedPagesSetup;

        // # Create source and target channels; user1 is member of both
        const [sourceChannel, targetChannel] = await Promise.all([
            createTestChannel(adminClient, team.id, 'Source Channel', 'O', [user1.id]),
            createTestChannel(adminClient, team.id, 'Target Channel', 'O', [user1.id]),
        ]);

        // # User 1 creates wiki in source channel
        const {page: page1} = await loginAndNavigateToChannel(pw, user1, team.name, sourceChannel.name);
        const wikiName = uniqueName('Wiki to Link');
        const wiki = await createWikiThroughUI(page1, wikiName);

        // # Create user2 in both channels and navigate to target
        const {user: user2} = await createTestUserInChannel(pw, adminClient, team, sourceChannel, 'user2');
        await adminClient.addToChannel(user2.id, targetChannel.id);
        const {page: user2Page} = await loginAndNavigateToChannel(pw, user2, team.name, targetChannel.name);

        // * Verify wiki tab is NOT visible in target for user2 yet
        const targetWikiTab = getWikiTab(user2Page, wikiName);
        await expect(targetWikiTab).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Setup WebSocket event logging for user2
        await setupWebSocketEventLogging(user2Page);

        // # User 1 links wiki to target channel via API (triggers wiki_linked WS event)
        await linkWikiToChannel(adminClient, targetChannel.id, wiki.id);

        // * Verify wiki tab appears in target channel for user2 (real-time, no refresh)
        await expect(targetWikiTab).toBeVisible({timeout: HIERARCHY_TIMEOUT});

        await user2Page.close();
    },
);

/**
 * @objective Verify wiki tab disappears in real-time for other users when wiki is unlinked from their channel
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 * Wiki is linked to a channel both users share
 */
test(
    'removes wiki tab in real-time for other users when wiki is unlinked from their channel',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user: user1, adminClient} = sharedPagesSetup;

        // # Create source and target channels; user1 is member of both
        const [sourceChannel, targetChannel] = await Promise.all([
            createTestChannel(adminClient, team.id, 'Source Channel', 'O', [user1.id]),
            createTestChannel(adminClient, team.id, 'Target Channel', 'O', [user1.id]),
        ]);

        // # User 1 creates wiki in source, links to target
        const {page: page1, channelsPage: channelsPage1} = await loginAndNavigateToChannel(
            pw,
            user1,
            team.name,
            sourceChannel.name,
        );
        const wikiName = uniqueName('Wiki to Unlink');
        const wiki = await createWikiThroughUI(page1, wikiName);
        await linkWikiToChannel(adminClient, targetChannel.id, wiki.id);

        // # Create user2 and add to both channels; navigate to target
        const {user: user2} = await createTestUserInChannel(pw, adminClient, team, sourceChannel, 'user2');
        await adminClient.addToChannel(user2.id, targetChannel.id);
        const {page: user2Page} = await loginAndNavigateToChannel(pw, user2, team.name, targetChannel.name);

        // * Verify wiki tab is visible in target for user2
        const targetWikiTab = getWikiTab(user2Page, wikiName);
        await expect(targetWikiTab).toBeVisible({timeout: HIERARCHY_TIMEOUT});

        // # Setup WebSocket event logging for user2
        await setupWebSocketEventLogging(user2Page);

        // # User 1 navigates to target channel (via existing session) and unlinks wiki
        await channelsPage1.goto(team.name, targetChannel.name);
        await channelsPage1.toBeVisible();
        await waitForWikiTab(page1, wikiName);
        await unlinkWikiFromChannelThroughUI(page1, wikiName);

        // * Verify wiki tab disappeared from target channel for user2 (real-time)
        await expect(targetWikiTab).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

        await user2Page.close();
    },
);
