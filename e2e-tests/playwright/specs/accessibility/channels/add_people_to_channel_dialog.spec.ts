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
        const channelMenu = await channelsPage.openChannelMenu();
        await channelMenu.members.click();

        // # Open Add from the members RHS
        await channelsPage.sidebarRight.toBeVisible();
        await channelsPage.sidebarRight.addMembersButton.click();

        // * Verify the Add people dialog is visible
        const dialog = channelsPage.getAddPeopleToChannelModal();
        await dialog.toBeVisible();

        // * Verify the heading with channel name
        await expect(dialog.getHeading(channel.display_name)).toBeVisible();
        await pw.wait(pw.duration.one_sec);

        // * Verify the search input has proper accessibility attributes
        await expect(dialog.searchInput).toBeVisible();
        await expect(dialog.searchInput).toHaveAttribute('aria-autocomplete', 'list');

        // # Search for a text and navigate with arrow keys
        await pw.wait(pw.duration.half_sec);
        await dialog.searchInput.fill('u');
        await pw.wait(pw.duration.half_sec);

        // # Navigate down through the list
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowUp');

        // * Verify the selected row has the correct class
        await expect(dialog.selectedRow).toBeVisible();

        // * Verify image alt is displayed for user profile
        await expect(dialog.selectedAvatar).toHaveAttribute('alt', 'user profile image');

        // * Verify screen reader live region exists and has proper attributes
        await expect(dialog.srOnlyRegion).toHaveAttribute('aria-live', 'polite');
        await expect(dialog.srOnlyRegion).toHaveAttribute('aria-atomic', 'true');

        // # Search for an invalid text
        await dialog.searchInput.fill('somethingwhichdoesnotexist');
        await pw.wait(pw.duration.half_sec);

        // * Check if the no results message is displayed with proper accessibility
        await expect(dialog.noResultsWrapper).toHaveAttribute('aria-live', 'polite');
        await expect(dialog.noResultsMessage).toBeVisible();
        await expect(dialog.noResultsMessage).toContainText('No results found matching');
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
        const channelMenu = await channelsPage.openChannelMenu();
        await channelMenu.members.click();

        // # Open Add from the members RHS
        await channelsPage.sidebarRight.toBeVisible();
        await channelsPage.sidebarRight.addMembersButton.click();

        // * Verify the Add people dialog is visible
        const dialog = channelsPage.getAddPeopleToChannelModal();
        await dialog.toBeVisible();
        await pw.wait(pw.duration.one_sec);

        // * Verify aria snapshot of Add people to Channel dialog
        await expect(dialog.container).toMatchAriaSnapshot(`
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
