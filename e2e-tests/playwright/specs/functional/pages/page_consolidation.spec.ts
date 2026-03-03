// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '../channels/pages/pages_test_fixture';
import {
    buildChannelUrl,
    createPageContent,
    uniqueName,
    PAGE_LOAD_TIMEOUT,
    WEBSOCKET_WAIT,
} from '../channels/pages/test_helpers';

test.describe('Page Activity Consolidation', () => {
    /**
     * @objective Verify multiple pages created by same user in same wiki are consolidated into a single message
     *
     * @precondition User has permission to create pages in the wiki
     */
    test(
        'Multiple pages created by same user in same wiki should be consolidated',
        {tag: '@pages'},
        async ({pw, sharedPagesSetup}) => {
            const {team, user, adminClient} = sharedPagesSetup;

            // # Get town-square channel
            const channel = await adminClient.getChannelByName(team.id, 'town-square');

            // # Create a wiki
            const wikiName = uniqueName('Consolidation Wiki');
            const wiki = await adminClient.createWiki({
                channel_id: channel.id,
                title: wikiName,
            });

            // # Login and navigate to the channel
            const {page} = await pw.testBrowser.login(user);
            const channelUrl = buildChannelUrl(pw.url, team.name, 'town-square');
            await page.goto(channelUrl);
            await page.waitForLoadState('networkidle');

            // # Wait for channel to fully load
            const postInput = page.locator('#post_textbox').first();
            await expect(postInput).toBeVisible({timeout: PAGE_LOAD_TIMEOUT});

            // # Create 3 pages via API (same user, same wiki)
            const pageContent = createPageContent('Test content');
            await pw.createPageViaDraft(adminClient, wiki.id, 'First Page', pageContent);
            await pw.createPageViaDraft(adminClient, wiki.id, 'Second Page', pageContent);
            await pw.createPageViaDraft(adminClient, wiki.id, 'Third Page', pageContent);

            // # Wait for WebSocket messages to propagate
            await page.waitForTimeout(WEBSOCKET_WAIT);

            // * Verify the consolidated message appears in the channel
            // * The message lists all page names in one message instead of 3 separate messages
            const channelFeed = page.locator('#postListContent');

            // * Should show all 3 pages in a single consolidated message
            // * Format: "{username} created {pageLinks} in the {wikiTitle} wiki tab"
            await expect(channelFeed).toContainText('Third Page, Second Page, First Page', {
                timeout: PAGE_LOAD_TIMEOUT,
            });
            await expect(channelFeed).toContainText('wiki tab', {timeout: PAGE_LOAD_TIMEOUT});
        },
    );

    /**
     * @objective Verify pages created in different wikis are NOT consolidated into a single message
     *
     * @precondition User has permission to create pages in multiple wikis
     */
    test(
        'Pages created in different wikis should NOT be consolidated',
        {tag: '@pages'},
        async ({pw, sharedPagesSetup}) => {
            const {team, user, adminClient} = sharedPagesSetup;

            // # Get town-square channel
            const channel = await adminClient.getChannelByName(team.id, 'town-square');

            // # Create two different wikis
            const wiki1 = await adminClient.createWiki({
                channel_id: channel.id,
                title: uniqueName('Wiki One'),
            });
            const wiki2 = await adminClient.createWiki({
                channel_id: channel.id,
                title: uniqueName('Wiki Two'),
            });

            // # Login and navigate to the channel
            const {page} = await pw.testBrowser.login(user);
            const channelUrl = buildChannelUrl(pw.url, team.name, 'town-square');
            await page.goto(channelUrl);
            await page.waitForLoadState('networkidle');

            // # Wait for channel to fully load
            const postInput = page.locator('#post_textbox').first();
            await expect(postInput).toBeVisible({timeout: PAGE_LOAD_TIMEOUT});

            // # Create a page in first wiki, then in second wiki, then back to first
            const pageContent = createPageContent('Test content');
            await pw.createPageViaDraft(adminClient, wiki1.id, 'Page in Wiki 1', pageContent);
            await pw.createPageViaDraft(adminClient, wiki2.id, 'Page in Wiki 2', pageContent);
            await pw.createPageViaDraft(adminClient, wiki1.id, 'Another Page in Wiki 1', pageContent);

            // # Wait for WebSocket messages to propagate
            await page.waitForTimeout(WEBSOCKET_WAIT);

            // * Verify we see individual messages (not consolidated across different wikis)
            // * Each wiki should have its own message(s)
            const channelFeed = page.locator('#postListContent');

            // * Should NOT see all 3 pages consolidated together since they're in different wikis
            const feedText = await channelFeed.textContent();
            expect(feedText).not.toContain('Page in Wiki 1, Page in Wiki 2');
            expect(feedText).not.toContain('Page in Wiki 2, Page in Wiki 1');

            // * Should see separate messages for each wiki
            await expect(channelFeed).toContainText('Page in Wiki 1', {timeout: PAGE_LOAD_TIMEOUT});
            await expect(channelFeed).toContainText('Page in Wiki 2', {timeout: PAGE_LOAD_TIMEOUT});
            await expect(channelFeed).toContainText('wiki tab', {timeout: PAGE_LOAD_TIMEOUT});
        },
    );

    /**
     * @objective Verify a regular message between page creations breaks the consolidation
     *
     * @precondition User has permission to create pages and posts
     */
    test(
        'Regular message between page creations should break consolidation',
        {tag: '@pages'},
        async ({pw, sharedPagesSetup}) => {
            const {team, user, adminClient} = sharedPagesSetup;

            // # Get town-square channel
            const channel = await adminClient.getChannelByName(team.id, 'town-square');

            // # Create a wiki
            const wiki = await adminClient.createWiki({
                channel_id: channel.id,
                title: uniqueName('Interruption Wiki'),
            });

            // # Login and navigate to the channel
            const {page} = await pw.testBrowser.login(user);
            const channelUrl = buildChannelUrl(pw.url, team.name, 'town-square');
            await page.goto(channelUrl);
            await page.waitForLoadState('networkidle');

            // # Wait for channel to fully load
            const postInput = page.locator('#post_textbox').first();
            await expect(postInput).toBeVisible({timeout: PAGE_LOAD_TIMEOUT});

            // # Create first page
            const pageContent = createPageContent('Test content');
            await pw.createPageViaDraft(adminClient, wiki.id, 'Page Before Message', pageContent);

            // # Post a regular message
            await adminClient.createPost({
                channel_id: channel.id,
                message: 'This message interrupts the page creation sequence',
            });

            // # Create second page
            await pw.createPageViaDraft(adminClient, wiki.id, 'Page After Message', pageContent);

            // # Wait for WebSocket messages to propagate
            await page.waitForTimeout(WEBSOCKET_WAIT);

            // * Verify the messages are separate (not consolidated across the interrupting message)
            const channelFeed = page.locator('#postListContent');

            // * Should NOT see both pages consolidated together since they're separated by a regular message
            const feedText = await channelFeed.textContent();
            expect(feedText).not.toContain('Page Before Message, Page After Message');
            expect(feedText).not.toContain('Page After Message, Page Before Message');

            // * Should see the interrupting message
            await expect(channelFeed).toContainText('interrupts the page creation sequence', {
                timeout: PAGE_LOAD_TIMEOUT,
            });

            // * Should see separate page creation messages
            await expect(channelFeed).toContainText('Page Before Message', {timeout: PAGE_LOAD_TIMEOUT});
            await expect(channelFeed).toContainText('Page After Message', {timeout: PAGE_LOAD_TIMEOUT});
        },
    );

    /**
     * @objective Verify single page creation shows singular message format
     *
     * @precondition User has permission to create pages
     */
    test('Single page creation should show singular message', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;

        // # Get town-square channel
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // # Create a wiki
        const wiki = await adminClient.createWiki({
            channel_id: channel.id,
            title: uniqueName('Single Page Wiki'),
        });

        // # Login and navigate to the channel
        const {page} = await pw.testBrowser.login(user);
        const channelUrl = buildChannelUrl(pw.url, team.name, 'town-square');
        await page.goto(channelUrl);
        await page.waitForLoadState('networkidle');

        // # Wait for channel to fully load
        const postInput = page.locator('#post_textbox').first();
        await expect(postInput).toBeVisible({timeout: PAGE_LOAD_TIMEOUT});

        // # Create single page
        const pageContent = createPageContent('Test content');
        await pw.createPageViaDraft(adminClient, wiki.id, 'Single Page', pageContent);

        // # Wait for WebSocket messages to propagate
        await page.waitForTimeout(WEBSOCKET_WAIT);

        // * Verify the singular message appears
        // * Format: "{username} created {pageLink} in the {wikiTitle} wiki tab"
        const channelFeed = page.locator('#postListContent');
        await expect(channelFeed).toContainText('created Single Page in the', {timeout: PAGE_LOAD_TIMEOUT});
        await expect(channelFeed).toContainText('wiki tab', {timeout: PAGE_LOAD_TIMEOUT});
    });

    /**
     * @objective Verify "wiki tab" terminology is used instead of "doc tab" in page activity messages
     *
     * @precondition User has permission to create pages
     */
    test('Wiki tab terminology should be used instead of doc tab', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;

        // # Get town-square channel
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // # Create a wiki
        const wiki = await adminClient.createWiki({
            channel_id: channel.id,
            title: uniqueName('Terminology Wiki'),
        });

        // # Login and navigate to the channel
        const {page} = await pw.testBrowser.login(user);
        const channelUrl = buildChannelUrl(pw.url, team.name, 'town-square');
        await page.goto(channelUrl);
        await page.waitForLoadState('networkidle');

        // # Wait for channel to fully load
        const postInput = page.locator('#post_textbox').first();
        await expect(postInput).toBeVisible({timeout: PAGE_LOAD_TIMEOUT});

        // # Create a page
        const pageContent = createPageContent('Test content');
        await pw.createPageViaDraft(adminClient, wiki.id, 'Terminology Test Page', pageContent);

        // # Wait for WebSocket messages to propagate
        await page.waitForTimeout(WEBSOCKET_WAIT);

        // * Verify "wiki tab" is used and NOT "doc tab"
        const channelFeed = page.locator('#postListContent');
        const feedText = await channelFeed.textContent();

        // * Should contain "wiki tab"
        expect(feedText).toContain('wiki tab');

        // * Should NOT contain "doc tab"
        expect(feedText).not.toContain('doc tab');
    });
});
