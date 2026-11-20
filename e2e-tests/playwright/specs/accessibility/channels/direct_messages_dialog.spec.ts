// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';

import {Api, type App, expect, test, waitForApi} from '@mattermost/playwright-lib';

/** Opens the Direct Messages dialog from the "Write a direct message" button on the sidebar's DM category. */
async function openDirectMessagesDialog(app: App, client: Client4, userId: string, teamId: string) {
    const {categories} = await client.getChannelCategories(userId, teamId);
    const directMessages = categories.find((category) => category.type === 'direct_messages');
    if (!directMessages) {
        throw new Error('the user has no direct messages category');
    }
    const button = app.lhs.channelList.category(directMessages).newDirectMessageButton;
    await expect(button).toHaveAccessibleName('Write a direct message');
    return button.clickTo(app.directMessagesModal);
}

/** Fills the dialog's search and waits for the search response for that term. */
async function search(app: App, term: string) {
    await Promise.all([
        waitForApi(app.page, Api.SearchUsers, {
            predicate: (_, response) => response.request().postDataJSON()?.term === term,
        }),
        app.directMessagesModal.options.searchCombobox.fill(term),
    ]);
}

/**
 * @objective Verify accessibility support in Direct Messages Dialog screen
 */
test(
    'MM-T1466 Accessibility Support in Direct Messages Dialog screen',
    {tag: ['@accessibility', '@direct_messages']},
    async ({pw}) => {
        // # Skip test if no license for Guest Accounts
        await pw.skipIfNoLicense();

        // # Initialize setup with admin and another user
        const {team, adminUser, adminClient} = await pw.initSetup();

        // # Create additional user and add to team
        const user2 = await adminClient.createUser(await pw.random.user(), '', '');
        await adminClient.addToTeam(team.id, user2.id);

        // # Log in as admin
        const {app} = await pw.testBrowser.login(adminUser);

        // # Visit town-square channel
        await app.channelsPage.goto({team, channel: 'town-square'});
        await expect(app.center.postCreate).toBeVisible();

        // # Click on the Write a direct message button to open the Direct Messages dialog
        const dialog = await openDirectMessagesDialog(app, adminClient, adminUser.id, team.id);

        // * Verify the Direct Messages dialog is visible
        await expect(dialog).toHaveAccessibleName('Direct Messages');

        // * Verify the heading (the dialog title has no part of its own)
        await expect(dialog.container.locator.getByRole('heading', {name: 'Direct Messages'})).toBeVisible();

        // * Verify the search input has proper accessibility attributes
        const searchInput = dialog.options.searchCombobox;
        await expect(searchInput).toHaveAccessibleName('Search for people');
        await expect(searchInput).toHaveAttribute('aria-autocomplete', 'list');

        // # Search for a text and navigate with arrow keys
        await search(app, 's');

        // # Navigate down through the list
        await searchInput.press('ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowUp');

        // * Verify the selected row has the correct class. Which row the keyboard lands on depends on the
        // search order, so the selected row is found by its selection class.
        const selectedRow = dialog.options.results.container.locator.locator('.more-modal__row--selected');
        await expect(selectedRow).toBeVisible();

        // * Verify image alt is displayed for user profile
        const avatar = selectedRow.locator('img.Avatar');
        await expect(avatar).toHaveAttribute('alt', 'user profile image');

        // * Verify screen reader live region exists and has proper attributes
        const srOnlyRegion = dialog.options.results.selectionText;
        await expect(srOnlyRegion).toHaveAttribute('aria-live', 'polite');
        await expect(srOnlyRegion).toHaveAttribute('aria-atomic', 'true');

        // # Search for an invalid text
        const invalidSearchTerm = 'somethingwhichdoesnotexist';
        await searchInput.clear();
        await expect(searchInput).toHaveValue('');
        await search(app, invalidSearchTerm);

        // * Check if the no results message is displayed with proper accessibility
        const noResultsWrapper = dialog.options.results.liveRegion;
        await expect(noResultsWrapper).toHaveAttribute('aria-live', 'polite');
        await expect(dialog.options.results.noResultsText).toContainText(
            `No results found matching ${invalidSearchTerm}`,
        );
    },
);

/**
 * @objective Verify Direct Messages dialog passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Direct Messages dialog',
    {tag: ['@accessibility', '@direct_messages', '@snapshots']},
    async ({pw, axe}) => {
        // # Skip test if no license
        await pw.skipIfNoLicense();

        // # Initialize setup
        const {team, user, userClient} = await pw.initSetup();

        // # Log in as admin
        const {app, page} = await pw.testBrowser.login(user);

        // # Visit town-square channel
        await app.channelsPage.goto({team, channel: 'town-square'});
        await expect(app.center.postCreate).toBeVisible();

        // # Click on the Write a direct message button to open the Direct Messages dialog
        const dialog = await openDirectMessagesDialog(app, userClient, user.id, team.id);

        // * Verify the Direct Messages dialog is visible
        await expect(dialog).toHaveAccessibleName('Direct Messages');
        await pw.wait(pw.duration.one_sec);

        // * Verify aria snapshot of Direct Messages dialog (key structural elements only)
        await expect(dialog).toMatchAriaSnapshot(`
            - dialog "Direct Messages":
              - document:
                - heading "Direct Messages" [level=1]
                - button "Close"
                - application:
                  - log
                  - text: Search for people
                  - combobox "Search for people"
                  - button "Go"
        `);

        // * Analyze the Direct Messages dialog for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page)
            .include('[role="dialog"]')
            // Known violation, not yet addressed: scrollable-region-focusable in the Direct Messages dialog
            // The multiSelectList and sr-only status elements need to be keyboard accessible
            .disableRules(['color-contrast', 'scrollable-region-focusable'])
            .analyze();

        // * Should have no violations
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);
