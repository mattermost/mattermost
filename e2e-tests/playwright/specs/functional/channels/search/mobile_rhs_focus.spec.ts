// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test.describe('Mobile view RHS auto-focus', () => {
    // Shrink the window's width to trigger mobile view
    test.use({viewport: {width: 400, height: 1024}});

    /**
     * @objective Opening a thread shouldn't focus the search textbox, even briefly
     */
    test(
        'opens thread in mobile view without ever focusing the mobile search input',
        {tag: '@search'},
        async ({pw, isMobile}) => {
            const {user} = await pw.initSetup();

            // # Log in
            const {channelsPage, page} = await pw.testBrowser.login(user);

            // # Go to a channel
            await channelsPage.goto();
            await channelsPage.toBeVisible();

            // # Make a post
            await channelsPage.centerView.postCreate.postMessage('Root message for mobile thread focus test');

            // # Set up a listener to track if the search box ever gets focus
            await page.evaluate(() => {
                (window as any).sbrSearchBoxFocusCount = 0;
                document.addEventListener('focusin', (e) => {
                    if (e.target && 'id' in e.target && e.target.id === 'sbrSearchBox') {
                        (window as any).sbrSearchBoxFocusCount += 1;
                    }
                });
            });

            // # Open the thread
            const lastPost = await channelsPage.getLastPost();
            await lastPost.openAThread();
            await channelsPage.sidebarRight.toBeVisible();

            // * Verify that the textbox is automatically focused on non-mobile devices
            if (!isMobile) {
                await expect(channelsPage.sidebarRight.postCreate.input).toBeFocused();
            }

            // * Verify the mobile RHS search input never received focus
            const searchFocusCount = await page.evaluate(() => (window as any).sbrSearchBoxFocusCount);
            expect(searchFocusCount).toBe(0);
        },
    );

    /**
     * @objective Opening the search RHS auto-focuses the search input in the RHS
     */
    test('opens search RHS in mobile view and focuses the mobile search input', {tag: '@search'}, async ({pw}) => {
        const {user} = await pw.initSetup();

        // # Log in as the test user
        const {channelsPage} = await pw.testBrowser.login(user);

        // # Visit a default channel page
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // # Click the mobile channel header search button to open the search RHS
        await channelsPage.mobileNavbar.openSearch();
        await channelsPage.sidebarRight.toBeVisible();

        // * Verify the mobile RHS search input is focused
        await expect(channelsPage.sidebarRight.mobileSearchInput).toBeFocused();
    });

    /**
     * @objective Verify that in narrow/mobile view, the channel header shows an icon-only Search
     * button; clicking it opens the RHS search panel where a search can be performed, and closing
     * the panel returns to the icon-only Search button.
     */
    test(
        'MM-T349 MM-T369 search icon in narrow view opens search, searches, and closes back to icon',
        {tag: '@search'},
        async ({pw}) => {
            const {user} = await pw.initSetup();

            // # Log in as the test user
            const {channelsPage} = await pw.testBrowser.login(user);

            // # Visit a default channel page and post a message to search for
            await channelsPage.goto();
            await channelsPage.toBeVisible();
            const message = `test message for narrow view search ${pw.random.id()}`;
            await channelsPage.centerView.postCreate.postMessage(message);

            // * Verify the icon-only Search button is shown in the narrow-width header
            await expect(channelsPage.mobileNavbar.searchButton).toBeVisible();

            // # Click it to open the RHS search panel
            await channelsPage.mobileNavbar.openSearch();
            await channelsPage.sidebarRight.toBeVisible();
            const {mobileSearchInput} = channelsPage.sidebarRight;
            await expect(mobileSearchInput).toBeFocused();

            // # Perform a search
            await mobileSearchInput.fill(message);
            await mobileSearchInput.press('Enter');

            // * Verify search results appear
            await channelsPage.searchResultsPanel.toContainText(message);

            // # Close the search panel
            await channelsPage.sidebarRight.closeMobile();

            // * Verify it collapses back to the icon-only Search button
            await expect(channelsPage.sidebarRight.container).not.toBeVisible();
            await expect(channelsPage.mobileNavbar.searchButton).toBeVisible();
        },
    );
});
