// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify accessibility support in Add people to Channel Dialog screen
 */
test(
    'MM-T1468 Accessibility Support in Add people to Channel Dialog screen',
    {tag: ['@accessibility', '@add_people_channel']},
    async ({pw}) => {
        // # Skip test if no license
        await pw.skipIfNoLicense();

        // # Initialize setup
        const {team, adminUser, adminClient} = await pw.initSetup();

        // # Create a channel in the team
        const channel = await adminClient.createChannel(
            pw.random.channel({
                teamId: team.id,
                displayName: 'Test Channel',
                name: 'test-channel',
            }),
        );

        // # Create additional users and add to team
        for (let i = 0; i < 5; i++) {
            const newUser = await adminClient.createUser(await pw.random.user(), '', '');
            await adminClient.addToTeam(team.id, newUser.id);
        }

        // # Log in as admin
        const {page, channelsPage} = await pw.testBrowser.login(adminUser);

        // # Visit the test channel
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        // # Open channel menu and click Members
        await channelsPage.centerView.header.openChannelMenu();
        const membersMenuItem = page.locator('#channelMembers');
        await membersMenuItem.click();

        // # Click the Add people button
        const addButton = page.getByRole('button', {name: 'Add people'});
        await addButton.click();

        // * Verify the Add people dialog is visible
        const dialog = page.getByRole('dialog').first();
        await expect(dialog).toBeVisible();

        // * Verify the heading with channel name
        const modalName = `Add people to ${channel.display_name}`;
        await expect(dialog.getByRole('heading', {name: modalName})).toBeVisible();
        await pw.wait(pw.duration.one_sec);

        // * Verify the search input has proper accessibility attributes
        const searchInput = dialog.getByLabel('Search for people or groups');
        await expect(searchInput).toBeVisible();
        await expect(searchInput).toHaveAttribute('aria-autocomplete', 'list');

        // # Search for a text and navigate with arrow keys
        await pw.wait(pw.duration.half_sec);
        await searchInput.fill('u');
        await pw.wait(pw.duration.half_sec);

        // # Navigate down through the list
        await page.keyboard.press('ArrowDown');
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
        await searchInput.fill('somethingwhichdoesnotexist');
        await pw.wait(pw.duration.half_sec);

        // * Check if the no results message is displayed with proper accessibility
        const noResultsWrapper = dialog.locator('.multi-select__wrapper');
        await expect(noResultsWrapper).toHaveAttribute('aria-live', 'polite');
        const noResultsMessage = dialog.locator('.no-channel-message .primary-message');
        await expect(noResultsMessage).toBeVisible();
        await expect(noResultsMessage).toContainText('No results found matching');
    },
);

/**
 * @objective Verify Add people to Channel dialog passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Add people to Channel dialog',
    {tag: ['@accessibility', '@add_people_channel', '@snapshots']},
    async ({pw, axe}) => {
        // # Skip test if no license
        await pw.skipIfNoLicense();

        // # Initialize setup
        const {team, adminUser, adminClient} = await pw.initSetup();

        // # Create a channel in the team
        const channel = await adminClient.createChannel(
            pw.random.channel({
                teamId: team.id,
                displayName: 'Test Channel',
                name: 'test-channel',
            }),
        );

        // # Create additional users and add to team
        for (let i = 0; i < 3; i++) {
            const newUser = await adminClient.createUser(await pw.random.user(), '', '');
            await adminClient.addToTeam(team.id, newUser.id);
        }

        // # Log in as admin
        const {page, channelsPage} = await pw.testBrowser.login(adminUser);

        // # Visit the test channel
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        // # Open channel menu and click Members
        await channelsPage.centerView.header.openChannelMenu();
        const membersMenuItem = page.locator('#channelMembers');
        await membersMenuItem.click();

        // # Click the Add people button
        const addButton = page.getByRole('button', {name: 'Add people'});
        await addButton.click();

        // * Verify the Add people dialog is visible
        const dialog = page.getByRole('dialog').first();
        await expect(dialog).toBeVisible();
        await pw.wait(pw.duration.one_sec);

        // * Verify aria snapshot of Add people to Channel dialog
        await expect(dialog).toMatchAriaSnapshot(`
            - dialog "Add people to Test Channel":
              - document:
                - heading "Add people to Test Channel" [level=1]
                - button "Close"
                - log
                - text: Search for people or groups
                - combobox "Search for people or groups"
                - button "Cancel"
                - button "Add"
        `);

        // * Analyze the Add people dialog for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page, {disableColorContrast: true})
            .include('[role="dialog"]')
            .analyze();

        // * Should have no violations
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);
