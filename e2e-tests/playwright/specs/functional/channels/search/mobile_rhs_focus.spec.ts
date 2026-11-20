// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';

import {expect, test} from '@mattermost/playwright-lib';

/** Waits until the element stops moving (a sliding menu has finished its entrance animation). */
async function toBeStill(element: Locator) {
    let previous = '';
    await expect
        .poll(async () => {
            const box = await element.boundingBox();
            const current = JSON.stringify(box);
            const still = Boolean(box) && current === previous;
            previous = current;
            return still;
        })
        .toBe(true);
}

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
            const {user, team, userClient, townSquare} = await pw.initSetup();
            // # Make a post, then log in and go to its channel
            const root = await userClient.createPost({
                channel_id: townSquare.id,
                message: 'Root message for mobile thread focus test',
            });
            const {app, page} = await pw.testBrowser.login(user);
            await app.channelsPage.goto({team, channel: townSquare});
            const rootPost = app.center.postList.post(root);
            await expect(rootPost.message.container).toBeVisible();

            // # Set up a listener to track if the mobile search input ever gets focus
            const searchInputTestId = 'search.mobile_bar.input--textbox';
            await page.evaluate((testId) => {
                (window as any).sbrSearchBoxFocusCount = 0;
                document.addEventListener('focusin', (e) => {
                    if (e.target instanceof HTMLElement && e.target.dataset.testid === testId) {
                        (window as any).sbrSearchBoxFocusCount += 1;
                    }
                });
            }, searchInputTestId);

            // # Open the thread
            await rootPost.container.hover();
            await rootPost.menu.replyButton.click();
            await expect(app.rhs.postCreate.message.container).toBeVisible();
            const rhsInput = app.rhs.postCreate.message.container;
            await expect(rhsInput).toBeVisible();

            // * Verify that the textbox is automatically focused on non-mobile devices
            if (!isMobile) {
                await expect(rhsInput).toBeFocused();
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
        const {user, team, townSquare} = await pw.initSetup();
        // # Log in as the test user and visit a default channel page
        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: townSquare});

        // # Click the mobile channel header search button to open the search RHS
        await app.mobileHeader.searchButton.click();

        // * Verify the mobile RHS search input is focused
        await expect(app.search.mobileBar.inputTextbox).toBeFocused();
    });

    /**
     * @objective Tapping the mobile menu backdrop should dismiss/close the modal
     */
    test('closes mobile menu when clicking the backdrop layer', {tag: '@mobile'}, async ({pw}) => {
        const {user, team, townSquare} = await pw.initSetup();
        // # Log in as the test user and navigate to channels page
        const {app, page} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: townSquare});

        // # Open the mobile channel header menu (on mobile it opens as a modal)
        await app.mobileHeader.openMenuButton.click();
        const menu = app.channelHeader.menu;

        // * Verify the menu is open
        const item = menu.toggleFavoriteMenuItem;
        await expect(item).toBeVisible();

        // # Wait for the modal's entrance animation to finish. Until it does, the menu is still
        // # sliding down through the top-left corner, so the click below would land on a menu item
        // The animation check compares bounding boxes, which requires a Locator.
        await toBeStill(item.locator);

        // # Click the modal's backdrop layer outside the menu content
        await page.mouse.click(5, 5);

        // * Verify the mobile menu modal is now successfully dismissed/hidden
        await expect(item).toBeHidden();
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
            const {user, team, userClient, townSquare} = await pw.initSetup();
            // # Post a message to search for, then log in and visit a default channel page
            const message = `test message for narrow view search ${pw.random.id()}`;
            const post = await userClient.createPost({channel_id: townSquare.id, message});
            const {app} = await pw.testBrowser.login(user);
            await app.channelsPage.goto({team, channel: townSquare});

            // * Verify the icon-only Search button is shown in the narrow-width header
            const searchButton = app.mobileHeader.searchButton;
            await expect(searchButton).toBeVisible();

            // # Click it to open the RHS search panel
            await app.mobileHeader.searchButton.click();
            const input = app.search.mobileBar.inputTextbox;
            await expect(input).toBeFocused();

            // # Perform a search
            await input.fill(message);
            await input.press('Enter');

            // * Verify search results appear
            await expect(app.search.results.post(post).message.container).toHaveText(message);

            // # Close the search panel
            await app.search.mobileBar.backButton.click();

            // * Verify it collapses back to the icon-only Search button
            await expect(input).not.toBeVisible();
            await expect(searchButton).toBeVisible();
        },
    );
});
