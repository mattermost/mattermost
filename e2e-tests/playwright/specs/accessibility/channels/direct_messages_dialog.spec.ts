// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

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
        const {page, channelsPage} = await pw.testBrowser.login(adminUser);

        // # Visit town-square channel
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Click on the Write a direct message button to open the Direct Messages dialog
        const writeDirectMessageButton = page.getByRole('button', {name: 'Write a direct message'});
        await writeDirectMessageButton.click();

        // * Verify the Direct Messages dialog is visible
        const dialog = page.getByRole('dialog', {name: 'Direct Messages'});
        await expect(dialog).toBeVisible();

        // * Verify the heading
        await expect(dialog.getByRole('heading', {name: 'Direct Messages'})).toBeVisible();

        // * Verify the search input has proper accessibility attributes
        const searchInput = dialog.getByLabel('Search for people');
        await expect(searchInput).toBeVisible();
        await expect(searchInput).toHaveAttribute('aria-autocomplete', 'list');

        // # Search for a text and navigate with arrow keys
        await searchInput.fill('s');
        await pw.wait(pw.duration.half_sec);

        // # Navigate down through the list
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowUp');

        // * Verify the selected row has the correct class
        const selectedRow = dialog.locator('#multiSelectList').locator('.more-modal__row--selected');
        await expect(selectedRow).toBeVisible();

        // * Verify image alt is displayed for user profile
        const avatar = selectedRow.locator('img.Avatar');
        await expect(avatar).toHaveAttribute('alt', 'user profile image');

        // * Verify screen reader live region exists and has proper attributes
        const srOnlyRegion = dialog.locator('.filtered-user-list div.sr-only:not([role="status"])');
        await expect(srOnlyRegion).toHaveAttribute('aria-live', 'polite');
        await expect(srOnlyRegion).toHaveAttribute('aria-atomic', 'true');

        // # Search for an invalid text
        const invalidSearchTerm = 'somethingwhichdoesnotexist';
        await searchInput.clear();
        await searchInput.fill(invalidSearchTerm);
        await pw.wait(pw.duration.half_sec);

        // * Check if the no results message is displayed with proper accessibility
        const noResultsWrapper = dialog.locator('.multi-select__wrapper');
        await expect(noResultsWrapper).toHaveAttribute('aria-live', 'polite');
        await expect(noResultsWrapper).toContainText(`No results found matching ${invalidSearchTerm}`);
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
        const {team, user} = await pw.initSetup();

        // # Log in as admin
        const {page, channelsPage} = await pw.testBrowser.login(user);

        // # Visit town-square channel
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Click on the Write a direct message button to open the Direct Messages dialog
        const writeDirectMessageButton = page.getByRole('button', {name: 'Write a direct message'});
        await writeDirectMessageButton.click();

        // * Verify the Direct Messages dialog is visible
        const dialog = page.getByRole('dialog', {name: 'Direct Messages'});
        await expect(dialog).toBeVisible();
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
            .builder(page, {disableColorContrast: true})
            .include('[role="dialog"]')
            // TODO: Address scrollable-region-focusable violation in the Direct Messages dialog
            // The multiSelectList and sr-only status elements need to be keyboard accessible
            .disableRules(['scrollable-region-focusable'])
            .analyze();

        // * Should have no violations
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);
