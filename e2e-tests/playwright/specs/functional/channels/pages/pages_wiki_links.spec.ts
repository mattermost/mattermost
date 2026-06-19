// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';
import {
    createPageContent,
    createPageViaAPI,
    createTestChannel,
    createTestUserInChannel,
    createWikiThroughUI,
    createWikiViaAPI,
    getAllWikiTabs,
    getWikiOverflowMenu,
    getWikiTab,
    linkWikiToChannelThroughUI,
    linkWikiToChannel,
    openLinkWikiModal,
    loginAndNavigateToChannel,
    navigateToChannelFromWiki,
    openWikiByTab,
    uniqueName,
    unlinkWikiFromChannelThroughUI,
    verifyPageContentContains,
    waitForWikiTab,
    waitForWikiViewLoad,
    ELEMENT_TIMEOUT,
    HIERARCHY_TIMEOUT,
    PAGE_LOAD_TIMEOUT,
} from './test_helpers';

test.describe('Wiki Links', () => {
    // ============================================================================
    // Linking wikis via UI
    // ============================================================================

    /**
     * @objective Verify a wiki from another channel can be linked to the current channel
     * via the "+" menu → "Link a wiki" option and appears as a tab
     *
     * @precondition
     * A wiki must exist in another channel in the same team
     */
    test('links an existing wiki to a channel via the tab bar', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;

        // # Create two channels — source (where wiki lives) and target (where we'll link it)
        // User must be a member of source channel so they gain wiki channel membership via SaveAndPropagateMembers
        const sourceChannel = await createTestChannel(adminClient, team.id, 'Source Channel', 'O', [user.id]);
        const targetChannel = await createTestChannel(adminClient, team.id, 'Target Channel');

        // # Create a wiki and link it to the source channel so the user (member of source) gains
        // # membership in the wiki's backing channel via SaveAndPropagateMembers, making it visible.
        const wikiTitle = uniqueName('Linkable Wiki');
        const wiki = await createWikiViaAPI(adminClient, team.id, wikiTitle);
        await linkWikiToChannel(adminClient, sourceChannel.id, wiki.id);

        // # Login and navigate to the target channel
        const {page} = await loginAndNavigateToChannel(pw, user, team.name, targetChannel.name);

        // # Link the wiki to the target channel through the UI
        await linkWikiToChannelThroughUI(page, wikiTitle);

        // * Verify wiki tab now appears in the target channel's tab bar
        const wikiTab = getWikiTab(page, wikiTitle);
        await expect(wikiTab).toBeVisible({timeout: ELEMENT_TIMEOUT});
    });

    /**
     * @objective Verify multiple wikis can be linked to a single channel and all show as tabs
     *
     * @precondition
     * Multiple wikis must exist in the team
     */
    test('shows multiple linked wiki tabs in a channel', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;

        // # Create channels — user must be in source to gain wiki channel membership
        const sourceChannel = await createTestChannel(adminClient, team.id, 'Multi Source', 'O', [user.id]);
        const targetChannel = await createTestChannel(adminClient, team.id, 'Multi Target');

        // # Create two wikis and link both to source channel so user gains backing-channel membership
        const wiki1Title = uniqueName('Wiki Alpha');
        const wiki2Title = uniqueName('Wiki Beta');
        const wiki1 = await createWikiViaAPI(adminClient, team.id, wiki1Title);
        const wiki2 = await createWikiViaAPI(adminClient, team.id, wiki2Title);
        await linkWikiToChannel(adminClient, sourceChannel.id, wiki1.id);
        await linkWikiToChannel(adminClient, sourceChannel.id, wiki2.id);

        // # Login and navigate to target channel
        const {page} = await loginAndNavigateToChannel(pw, user, team.name, targetChannel.name);

        // # Link first wiki through UI
        await linkWikiToChannelThroughUI(page, wiki1Title);

        // * Verify first wiki tab is visible
        await expect(getWikiTab(page, wiki1Title)).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Link second wiki through UI
        await linkWikiToChannelThroughUI(page, wiki2Title);

        // * Verify both wiki tabs are visible
        await expect(getWikiTab(page, wiki1Title)).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await expect(getWikiTab(page, wiki2Title)).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // * Verify there are exactly 2 wiki tabs
        const allWikiTabs = getAllWikiTabs(page);
        await expect(allWikiTabs).toHaveCount(2);
    });

    // ============================================================================
    // Unlinking wikis via UI
    // ============================================================================

    /**
     * @objective Verify a wiki can be unlinked from a channel via the tab menu
     * and the tab disappears from the tab bar
     *
     * @precondition
     * Wiki must be linked to the channel
     */
    test('unlinks a wiki from a channel via the tab menu', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;

        // # Create a channel and a wiki, link them via API (setup)
        const channel = await createTestChannel(adminClient, team.id, 'Unlink Channel', 'O', [user.id]);
        const wikiTitle = uniqueName('Unlink Wiki');
        const wiki = await createWikiViaAPI(adminClient, team.id, wikiTitle);
        await linkWikiToChannel(adminClient, channel.id, wiki.id);

        // # Login and navigate to the channel
        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // * Verify the wiki tab is initially visible
        await waitForWikiTab(page, wikiTitle);

        // # Unlink the wiki via the tab menu
        await unlinkWikiFromChannelThroughUI(page, wikiTitle);

        // * Verify the wiki tab is no longer visible
        const wikiTab = getWikiTab(page, wikiTitle);
        await expect(wikiTab).not.toBeVisible({timeout: ELEMENT_TIMEOUT});
    });

    /**
     * @objective Verify that when viewing a wiki and unlinking it, the user is
     * redirected back to the channel messages view
     *
     * @precondition
     * User must be viewing the wiki that gets unlinked
     */
    test('redirects to messages when unlinking active wiki', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;

        const channel = await createTestChannel(adminClient, team.id, 'Redirect Channel', 'O', [user.id]);

        // # Login and navigate to channel, create wiki through UI
        const {page, channelsPage} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);
        const wikiTitle = uniqueName('Active Wiki');
        await createWikiThroughUI(page, wikiTitle);

        // # Navigate back to channel so we can use the tab bar
        await navigateToChannelFromWiki(page, channelsPage, team.name, channel.name);
        await waitForWikiTab(page, wikiTitle);

        // # Unlink the wiki
        await unlinkWikiFromChannelThroughUI(page, wikiTitle);

        // * Verify we're on the channel messages view (not wiki view)
        await expect(page).toHaveURL(new RegExp(`/${team.name}/channels/${channel.name}`));

        // * Verify the wiki tab is gone
        const wikiTab = getWikiTab(page, wikiTitle);
        await expect(wikiTab).not.toBeVisible({timeout: ELEMENT_TIMEOUT});
    });

    // ============================================================================
    // Tab overflow
    // ============================================================================

    /**
     * @objective Verify that when 3+ wikis are linked, overflow menu appears with "+N more"
     *
     * @precondition
     * Three or more wikis must be linked to the channel
     */
    test('shows overflow menu when 3+ wikis are linked', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;

        // # Create channel with user as a member so wiki tabs are reachable without
        // depending on the public-channel auto-join race after navigation.
        const channel = await createTestChannel(adminClient, team.id, 'Overflow Channel', 'O', [user.id]);

        // # Create 3 wikis and link them to the channel
        const wikiTitles = [uniqueName('Wiki 1'), uniqueName('Wiki 2'), uniqueName('Wiki 3')];
        for (const title of wikiTitles) {
            const w = await createWikiViaAPI(adminClient, team.id, title);
            await linkWikiToChannel(adminClient, channel.id, w.id);
        }

        // # Login and navigate to the channel
        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Wait for wiki tabs to load — use HIERARCHY_TIMEOUT since 3 wikis must
        // sync to the user's view after navigation, which can exceed the default 5s
        // under batch test load.
        await waitForWikiTab(page, wikiTitles[0], HIERARCHY_TIMEOUT);

        // * Verify only 2 wiki tabs are visible (first two)
        const visibleWikiTabs = getAllWikiTabs(page);
        await expect(visibleWikiTabs).toHaveCount(2);

        // * Verify the overflow menu is visible with "+1 more"
        const overflowMenu = getWikiOverflowMenu(page);
        await expect(overflowMenu).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Click the overflow menu
        await overflowMenu.click();

        // * Verify the third wiki title appears in the dropdown.
        // Menu.Container renders menu.id as the DOM id attribute, so use #id
        // (matches waitForWikiTab in test_helpers.ts).
        const overflowDropdown = page.locator('#wiki-overflow-menu-dropdown');
        const overflowItem = overflowDropdown.getByText(wikiTitles[2]);
        await expect(overflowItem.first()).toBeVisible({timeout: ELEMENT_TIMEOUT});
    });

    // ============================================================================
    // Creating wikis via tab bar
    // ============================================================================

    /**
     * @objective Verify a new wiki can be created via the "+" menu → "Create wiki"
     * and it appears as a tab in the channel
     *
     * @precondition
     * Channel must be navigated to
     */
    test('creates a wiki via the tab bar and it appears as a tab', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;

        const channel = await createTestChannel(adminClient, team.id, 'Create Wiki Channel');

        // # Login and navigate to the channel
        const {page, channelsPage} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create a wiki through the UI
        const wikiTitle = uniqueName('New Wiki');
        await createWikiThroughUI(page, wikiTitle);

        // # Navigate back to channel to see tabs
        await navigateToChannelFromWiki(page, channelsPage, team.name, channel.name);

        // * Verify the wiki tab appears
        const wikiTab = getWikiTab(page, wikiTitle);
        await expect(wikiTab).toBeVisible({timeout: ELEMENT_TIMEOUT});
    });
    // ============================================================================
    // Channel-independent wiki behavior
    // ============================================================================

    /**
     * @objective Verify the same wiki can be linked to two different channels
     * and appears as a tab in both
     *
     * @precondition
     * A wiki must exist in the team
     */
    test('same wiki appears as tab in multiple linked channels', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;

        // # Create source channel (where wiki lives) and two target channels — user must be a member
        // # of the channels they navigate to so backing-channel membership propagates.
        const sourceChannel = await createTestChannel(adminClient, team.id, 'Wiki Home');
        const channelA = await createTestChannel(adminClient, team.id, 'Channel A', 'O', [user.id]);
        const channelB = await createTestChannel(adminClient, team.id, 'Channel B', 'O', [user.id]);

        // # Create a wiki and link it to both target channels via API
        const wikiTitle = uniqueName('Shared Wiki');
        const wiki = await createWikiViaAPI(adminClient, team.id, wikiTitle);
        await linkWikiToChannel(adminClient, sourceChannel.id, wiki.id);
        await linkWikiToChannel(adminClient, channelA.id, wiki.id);
        await linkWikiToChannel(adminClient, channelB.id, wiki.id);

        // # Login and navigate to channel A
        const {page, channelsPage} = await loginAndNavigateToChannel(pw, user, team.name, channelA.name);

        // * Verify wiki tab appears in channel A
        await expect(getWikiTab(page, wikiTitle)).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Navigate to channel B
        await channelsPage.goto(team.name, channelB.name);
        await channelsPage.toBeVisible();

        // * Verify the same wiki tab appears in channel B
        await expect(getWikiTab(page, wikiTitle)).toBeVisible({timeout: ELEMENT_TIMEOUT});
    });

    /**
     * @objective Verify that editing a page via one channel's wiki tab is visible
     * when viewing the same wiki through another channel
     *
     * @precondition
     * Wiki linked to two channels, with a published page
     */
    test('edits to a page are visible across linked channels', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
        test.setTimeout(180_000);
        const {team, user, adminClient} = sharedPagesSetup;

        // # Create source and two target channels — user must be a member of both target channels
        const sourceChannel = await createTestChannel(adminClient, team.id, 'Edit Source');
        const channelA = await createTestChannel(adminClient, team.id, 'Edit View A', 'O', [user.id]);
        const channelB = await createTestChannel(adminClient, team.id, 'Edit View B', 'O', [user.id]);

        // # Create a wiki with a page via API
        const wikiTitle = uniqueName('Edit Wiki');
        const wiki = await createWikiViaAPI(adminClient, team.id, wikiTitle);
        const pageContent = 'Content visible everywhere';
        await createPageViaAPI(adminClient, wiki.id, 'Shared Page', JSON.stringify(createPageContent(pageContent)));

        // # Link wiki to source and both target channels
        await linkWikiToChannel(adminClient, sourceChannel.id, wiki.id);
        await linkWikiToChannel(adminClient, channelA.id, wiki.id);
        await linkWikiToChannel(adminClient, channelB.id, wiki.id);

        // # Login and navigate to channel A, open wiki tab
        const {page, channelsPage} = await loginAndNavigateToChannel(pw, user, team.name, channelA.name);

        // TRACE: record all URL navigations from this point forward
        const navLog: string[] = [`start:${page.url()}`];
        page.on('framenavigated', (frame) => {
            if (frame === page.mainFrame()) {
                navLog.push(`nav:${frame.url()}`);
            }
        });

        // TRACE: record API responses to catch 403/404 redirects
        page.on('response', (response) => {
            const url = response.url();
            const status = response.status();
            if ((url.includes('/api/v4/pages/') || url.includes('/api/v4/wiki')) && status >= 300) {
                // eslint-disable-next-line no-console
                console.log(`[TRACE] API ${status}: ${url}`);
            }
        });

        // TRACE: capture browser console logs from React hooks (must be before openWikiByTab)
        page.on('console', (msg) => {
            const text = msg.text();
            if (
                text.includes('[useWikiPageData]') ||
                text.includes('[useAutoPageSelection]') ||
                text.includes('[wiki_view]') ||
                text.includes('[wiki_router]') ||
                text.includes('[channel_view]')
            ) {
                // eslint-disable-next-line no-console
                console.log('[BROWSER]', text);
            }
        });

        // TRACE: detect when page closes
        page.on('close', () => {
            // eslint-disable-next-line no-console
            console.log('[TRACE] page closed at url:', page.url());
        });

        await waitForWikiTab(page, wikiTitle);
        navLog.push(`after-waitForWikiTab:${page.url()}`);

        await openWikiByTab(page, wikiTitle);
        navLog.push(`after-openWikiByTab:${page.url()}`);

        // TRACE: capture DOM immediately after clicking the wiki tab
        const domState0 = await page.evaluate(() => ({
            url: window.location.href,
            innerWrap: document.querySelectorAll('.inner-wrap').length,
            channelView: document.querySelectorAll('[data-testid="channel_view"]').length,
            tabPanel: document.querySelectorAll('.channel-tab-panel').length,
            tabPanelId: document.querySelector('.channel-tab-panel')?.id ?? 'none',
            wikiView: document.querySelectorAll('[data-testid="wiki-view"]').length,
            loadingScreen: document.querySelectorAll('.loading-screen').length,
            appContent: document.querySelectorAll('#app-content').length,
            centerHtml: document.querySelector('.inner-wrap')?.innerHTML?.slice(0, 500) ?? 'none',
        }));
        // eslint-disable-next-line no-console
        console.log('[TRACE] DOM immediately after openWikiByTab:', JSON.stringify(domState0));

        await waitForWikiViewLoad(page);
        navLog.push(`after-waitForWikiViewLoad:${page.url()}`);
        // eslint-disable-next-line no-console
        console.log('[TRACE] navLog:', navLog.join(' | '));

        // * Verify the page content is visible in channel A's wiki view
        await verifyPageContentContains(page, pageContent);

        // # Navigate to channel B and open the same wiki tab
        await channelsPage.goto(team.name, channelB.name);
        await channelsPage.toBeVisible();
        await waitForWikiTab(page, wikiTitle);
        await openWikiByTab(page, wikiTitle);
        await waitForWikiViewLoad(page);

        // * Verify the same page content is visible in channel B's wiki view
        await verifyPageContentContains(page, pageContent);
    });

    /**
     * @objective Verify that unlinking a wiki from one channel does not affect
     * the wiki in other linked channels
     *
     * @precondition
     * Wiki linked to two channels
     */
    test(
        'unlinking from one channel does not affect other channels',
        {tag: '@pages'},
        async ({pw, sharedPagesSetup}) => {
            const {team, user, adminClient} = sharedPagesSetup;

            const sourceChannel = await createTestChannel(adminClient, team.id, 'Unlink Source');
            const channelA = await createTestChannel(adminClient, team.id, 'Keep Link', 'O', [user.id]);
            const channelB = await createTestChannel(adminClient, team.id, 'Remove Link', 'O', [user.id]);

            // # Create a wiki and link to source and both target channels
            const wikiTitle = uniqueName('Partial Unlink');
            const wiki = await createWikiViaAPI(adminClient, team.id, wikiTitle);
            await linkWikiToChannel(adminClient, sourceChannel.id, wiki.id);
            await linkWikiToChannel(adminClient, channelA.id, wiki.id);
            await linkWikiToChannel(adminClient, channelB.id, wiki.id);

            // # Login, navigate to channel B, and unlink the wiki
            const {page, channelsPage} = await loginAndNavigateToChannel(pw, user, team.name, channelB.name);
            await waitForWikiTab(page, wikiTitle);
            await unlinkWikiFromChannelThroughUI(page, wikiTitle);

            // * Verify wiki tab is gone from channel B
            await expect(getWikiTab(page, wikiTitle)).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

            // # Navigate to channel A
            await channelsPage.goto(team.name, channelA.name);
            await channelsPage.toBeVisible();

            // * Verify wiki tab is still present in channel A
            await expect(getWikiTab(page, wikiTitle)).toBeVisible({timeout: ELEMENT_TIMEOUT});
        },
    );

    /**
     * @objective Verify that a wiki unlinked from all channels can be re-linked
     *
     * @precondition
     * Wiki exists but is not linked to the target channel
     */
    test('wiki can be re-linked after unlinking from all channels', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;

        // User must be in source channel to gain wiki channel membership
        const sourceChannel = await createTestChannel(adminClient, team.id, 'Relink Source', 'O', [user.id]);
        const targetChannel = await createTestChannel(adminClient, team.id, 'Relink Target', 'O', [user.id]);

        // # Create a wiki and link to source + target channel
        const wikiTitle = uniqueName('Relink Wiki');
        const wiki = await createWikiViaAPI(adminClient, team.id, wikiTitle);
        await linkWikiToChannel(adminClient, sourceChannel.id, wiki.id);
        await linkWikiToChannel(adminClient, targetChannel.id, wiki.id);

        // # Login, navigate to target channel, unlink the wiki
        const {page} = await loginAndNavigateToChannel(pw, user, team.name, targetChannel.name);
        await waitForWikiTab(page, wikiTitle);
        await unlinkWikiFromChannelThroughUI(page, wikiTitle);

        // * Verify wiki tab is gone
        await expect(getWikiTab(page, wikiTitle)).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Re-link the wiki through UI
        await linkWikiToChannelThroughUI(page, wikiTitle);

        // * Verify wiki tab appears again
        await expect(getWikiTab(page, wikiTitle)).toBeVisible({timeout: ELEMENT_TIMEOUT});
    });

    /**
     * @objective Verify that linking the same wiki to a channel twice is prevented
     *
     * @precondition
     * Wiki is already linked to the target channel
     */
    test('cannot link the same wiki to a channel twice', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;

        const targetChannel = await createTestChannel(adminClient, team.id, 'Dup Target', 'O', [user.id]);

        // # Create a wiki and link it to the target channel via API
        // SaveAndPropagateMembers will add the user (member of targetChannel) to the wiki
        // backing channel, so no separate source channel is needed.
        const wikiTitle = uniqueName('Dup Wiki');
        const wiki = await createWikiViaAPI(adminClient, team.id, wikiTitle);
        await linkWikiToChannel(adminClient, targetChannel.id, wiki.id);

        // # Login and navigate to target channel
        const {page} = await loginAndNavigateToChannel(pw, user, team.name, targetChannel.name);
        await waitForWikiTab(page, wikiTitle);

        // # Open the "Link a wiki" modal
        const linkModal = await openLinkWikiModal(page);

        // # Wait for wiki select to load
        const wikiSelect = linkModal.locator('#wiki-select');
        await expect(wikiSelect).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // * Verify the already-linked wiki is NOT in the dropdown options
        const options = wikiSelect.locator('option');
        const optionTexts = await options.allTextContents();
        const hasLinkedWiki = optionTexts.some((text) => text.includes(wikiTitle));
        expect(hasLinkedWiki).toBe(false);

        // # Close the modal
        const cancelButton = linkModal.getByRole('button', {name: /cancel/i});
        await cancelButton.click();
    });

    // ============================================================================
    // Cross-channel permissions
    // ============================================================================

    /**
     * @objective Verify a user can see a linked wiki and read its page content
     * even if they are NOT a member of the channel where the wiki was originally created.
     * This validates that member propagation (SaveAndPropagateMembers) grants the user
     * access to the wiki's underlying channel.
     *
     * @precondition
     * User has access to target channel but not source channel
     */
    test(
        'user sees wiki and reads page content through linked channel without source channel access',
        {tag: '@pages'},
        async ({pw, sharedPagesSetup}) => {
            const {team, adminClient} = sharedPagesSetup;

            // # Create a private source channel (restricted access)
            const sourceChannel = await createTestChannel(adminClient, team.id, 'Private Source', 'P');
            const targetChannel = await createTestChannel(adminClient, team.id, 'Public Target');

            // # Create a wiki and link it to the private source channel as its origin
            const wikiTitle = uniqueName('Cross Perm Wiki');
            const wiki = await createWikiViaAPI(adminClient, team.id, wikiTitle);
            await linkWikiToChannel(adminClient, sourceChannel.id, wiki.id);
            const pageContent = 'Content only accessible through member sync';
            await createPageViaAPI(adminClient, wiki.id, 'Synced Page', JSON.stringify(createPageContent(pageContent)));

            // # Link wiki to the public target channel — this propagates memberships
            await linkWikiToChannel(adminClient, targetChannel.id, wiki.id);

            // # Create a regular user who is in the team and target channel, but NOT in source channel
            const {user: regularUser} = await createTestUserInChannel(pw, adminClient, team, targetChannel);

            // # Login as the regular user and navigate to target channel
            const {page} = await loginAndNavigateToChannel(pw, regularUser, team.name, targetChannel.name);

            // * Verify the wiki tab is visible
            await waitForWikiTab(page, wikiTitle);

            // # Open the wiki via the tab
            await openWikiByTab(page, wikiTitle);
            await waitForWikiViewLoad(page);

            // * Verify the user can read the page content — proves member propagation worked
            await verifyPageContentContains(page, pageContent);
        },
    );

    // ============================================================================
    // Multi-user WebSocket propagation
    // ============================================================================

    /**
     * @objective Verify that when one user links a wiki, another user in the same
     * channel sees the wiki tab appear via WebSocket
     *
     * @precondition
     * Two users are logged in and viewing the same channel
     */
    test(
        'wiki tab appears for other users via WebSocket after linking',
        {tag: '@pages'},
        async ({pw, sharedPagesSetup}) => {
            const {team, adminClient} = sharedPagesSetup;

            const sourceChannel = await createTestChannel(adminClient, team.id, 'WS Source');
            const targetChannel = await createTestChannel(adminClient, team.id, 'WS Target');

            // # Create a wiki and link it to the source channel as its origin
            const wikiTitle = uniqueName('WS Wiki');
            const wiki = await createWikiViaAPI(adminClient, team.id, wikiTitle);
            await linkWikiToChannel(adminClient, sourceChannel.id, wiki.id);

            // # Create a second user in the target channel
            const {user: user2} = await createTestUserInChannel(pw, adminClient, team, targetChannel);

            // # Login both users — user2 is already viewing the target channel
            const {page: page2} = await loginAndNavigateToChannel(pw, user2, team.name, targetChannel.name);

            // # User1 links the wiki to the target channel via API
            await linkWikiToChannel(adminClient, targetChannel.id, wiki.id);

            // * Verify user2 sees the wiki tab appear via WebSocket
            await expect(getWikiTab(page2, wikiTitle)).toBeVisible({timeout: PAGE_LOAD_TIMEOUT});

            await page2.close();
        },
    );
});
