// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify arrow key navigation through all menu items in the team menu
 */
test(
    'navigate using arrow keys between menu items',
    {tag: ['@accessibility', '@team_menu', '@keyboard_navigation']},
    async ({pw}) => {
        // # Initialize setup and make the user a team admin to see all menu items
        const {user, team, adminClient} = await pw.initSetup();
        await adminClient.updateTeamMemberSchemeRoles(team.id, user.id, true, true);

        // # Log in a user in new browser context
        const {page, channelsPage} = await pw.testBrowser.login(user);
        const sidebarLeft = channelsPage.sidebarLeft;
        const teamMenu = channelsPage.teamMenu;

        // # Visit a default channel page
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // # Set focus on team menu button and press Enter to open the menu
        await sidebarLeft.teamMenuButton.focus();
        await page.keyboard.press('Enter');

        await pw.logFocusedElement(page);

        // * Team menu should be visible and focus should be on first menu item - "Invite people"
        await teamMenu.toBeVisible();
        await pw.toBeFocusedWithFocusVisible(teamMenu.invitePeople);

        // # Press ArrowDown to move focus to "Team settings" menu item
        await page.keyboard.press('ArrowDown');
        await pw.toBeFocusedWithFocusVisible(teamMenu.teamSettings);

        // # Press ArrowDown to move focus to "Manage members" menu item
        await page.keyboard.press('ArrowDown');
        await pw.toBeFocusedWithFocusVisible(teamMenu.manageMembers);

        // # Press ArrowDown to move focus to "Leave team" menu item
        await page.keyboard.press('ArrowDown');
        await pw.toBeFocusedWithFocusVisible(teamMenu.leaveTeam);

        // # Press ArrowDown to move focus to "Create a team" menu item
        await page.keyboard.press('ArrowDown');
        await pw.toBeFocusedWithFocusVisible(teamMenu.createTeam);

        // # Press ArrowDown to move focus to "Learn about teams" menu item
        await page.keyboard.press('ArrowDown');
        await pw.toBeFocusedWithFocusVisible(teamMenu.learnAboutTeams);
    },
);

/**
 * @objective Verify Tab key navigation escapes menu and moves to next focusable element
 */
test(
    'navigate using Tab key to escape menu',
    {tag: ['@accessibility', '@team_menu', '@keyboard_navigation']},
    async ({pw}) => {
        // # Create and sign in a new user
        const {user} = await pw.initSetup();
        const {page, channelsPage} = await pw.testBrowser.login(user);
        const sidebarLeft = channelsPage.sidebarLeft;
        const teamMenu = channelsPage.teamMenu;

        // # Visit a default channel page
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // # Set focus on team menu button and press Enter to open the menu
        await sidebarLeft.teamMenuButton.focus();
        await page.keyboard.press('Enter');

        // * Team menu should be visible and focus should be on first menu item
        await teamMenu.toBeVisible();
        await pw.toBeFocusedWithFocusVisible(teamMenu.invitePeople);

        // # Press Tab to exit menu and move to next focusable element outside menu
        await page.keyboard.press('Tab');

        // * Team menu should be closed and focus should move to next focusable element
        await expect(teamMenu.container).not.toBeVisible();

        // * Focus should be on the next focusable element - "Browse or create channels" button
        await expect(sidebarLeft.teamMenuButton).not.toBeFocused();
        await expect(sidebarLeft.browseOrCreateChannelButton).toBeFocused();
    },
);

/**
 * @objective Verify menu items can be activated using Enter and Space keys
 */
test(
    'activate menu items using Enter and Space keys',
    {tag: ['@accessibility', '@team_menu', '@keyboard_navigation']},
    async ({pw}) => {
        // # Initialize setup and make the user a team admin to see all menu items
        const {user, team, adminClient} = await pw.initSetup();
        await adminClient.updateTeamMemberSchemeRoles(team.id, user.id, true, true);

        // # Log in a user in new browser context
        const {page, channelsPage} = await pw.testBrowser.login(user);
        const sidebarLeft = channelsPage.sidebarLeft;
        const teamMenu = channelsPage.teamMenu;

        // # Visit a default channel page
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // # Click on team menu button to open the menu
        await sidebarLeft.teamMenuButton.focus();
        await page.keyboard.press('Enter');

        // * Team menu should be visible
        await teamMenu.toBeVisible();

        // # Set focus on "Team settings" menu item and press Enter
        await teamMenu.teamSettings.focus();
        await page.keyboard.press('Enter');

        // * Team settings modal should open (wait for navigation or modal)
        await channelsPage.teamSettingsModal.toBeVisible();

        // # Close the modal using Escape key
        await page.keyboard.press('Escape');

        await expect(channelsPage.teamSettingsModal.container).not.toBeVisible();

        // # Reopen team menu
        await sidebarLeft.teamMenuButton.focus();
        await page.keyboard.press('Enter');
        await teamMenu.toBeVisible();

        // # Set focus on "Learn about teams" menu item and press Space
        await teamMenu.invitePeople.focus();
        await page.keyboard.press(' ');

        // * Should navigate to learn about teams documentation or open modal
        const invitePeopleModal = await channelsPage.getInvitePeopleModal(team.display_name);
        await invitePeopleModal.toBeVisible();
    },
);

/**
 * @objective Verify Escape key closes the team menu
 */
test('close menu using Escape key', {tag: ['@accessibility', '@team_menu', '@keyboard_navigation']}, async ({pw}) => {
    // # Create and sign in a new user
    const {user} = await pw.initSetup();
    const {page, channelsPage} = await pw.testBrowser.login(user);
    const sidebarLeft = channelsPage.sidebarLeft;
    const teamMenu = channelsPage.teamMenu;

    // # Visit a default channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Click on team menu button to open the menu
    await sidebarLeft.teamMenuButton.click();

    // * Team menu should be visible
    await teamMenu.toBeVisible();

    // # Press Escape key
    await page.keyboard.press('Escape');

    // * Team menu should be closed
    await expect(teamMenu.container).not.toBeVisible();

    // * Focus should return to the team menu button
    await pw.toBeFocusedWithFocusVisible(sidebarLeft.teamMenuButton);
});

/**
 * @objective Verify team menu accessibility compliance and aria-snapshot structure
 */
test(
    'accessibility scan and aria-snapshot of team menu',
    {tag: ['@accessibility', '@team_menu', '@snapshots']},
    async ({pw, axe}) => {
        // # Initialize setup and make the user a team admin to see all menu items
        const {user, team, adminClient} = await pw.initSetup();
        await adminClient.updateTeamMemberSchemeRoles(team.id, user.id, true, true);

        // # Log in a user in new browser context
        const {page, channelsPage} = await pw.testBrowser.login(user);
        const sidebarLeft = channelsPage.sidebarLeft;
        const teamMenu = channelsPage.teamMenu;

        // # Visit a default channel page
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // # Click on team menu button to open the menu
        await sidebarLeft.teamMenuButton.click();

        // * Team menu should be visible
        await teamMenu.toBeVisible();

        // * Verify aria snapshot of team menu structure
        await expect(teamMenu.container).toMatchAriaSnapshot();

        // # Analyze the team menu for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page, {disableColorContrast: true})
            .include(teamMenu.getContainerId())
            .analyze();

        // * Should have no violations
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

/**
 * @objective Verify menu items have proper ARIA attributes for screen readers
 */
test(
    'verify ARIA attributes and screen reader support',
    {tag: ['@accessibility', '@team_menu', '@screen_reader']},
    async ({pw}) => {
        // # Initialize setup and make the user a team admin to see all menu items
        const {user, team, adminClient} = await pw.initSetup();
        await adminClient.updateTeamMemberSchemeRoles(team.id, user.id, true, true);

        // # Log in a user in new browser context
        const {channelsPage} = await pw.testBrowser.login(user);
        const sidebarLeft = channelsPage.sidebarLeft;
        const teamMenu = channelsPage.teamMenu;

        // # Visit a default channel page
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // # Click on team menu button to open the menu
        await sidebarLeft.teamMenuButton.click();

        // * Team menu should be visible
        await teamMenu.toBeVisible();

        // * Verify menu container has correct role
        await expect(teamMenu.container).toHaveAttribute('role', 'menu');

        // * Verify menu items have correct roles and attributes
        await expect(teamMenu.invitePeople).toHaveAttribute('role', 'menuitem');
        await expect(teamMenu.invitePeople).toHaveAttribute('aria-haspopup', 'dialog');

        await expect(teamMenu.teamSettings).toHaveAttribute('role', 'menuitem');
        await expect(teamMenu.teamSettings).toHaveAttribute('aria-haspopup', 'dialog');

        await expect(teamMenu.manageMembers).toHaveAttribute('role', 'menuitem');
        await expect(teamMenu.manageMembers).toHaveAttribute('aria-haspopup', 'dialog');

        await expect(teamMenu.leaveTeam).toHaveAttribute('role', 'menuitem');
        await expect(teamMenu.leaveTeam).toHaveAttribute('aria-haspopup', 'dialog');

        await expect(teamMenu.createTeam).toHaveAttribute('role', 'menuitem');

        await expect(teamMenu.learnAboutTeams).toHaveAttribute('role', 'menuitem');

        // * Verify menu items are focusable
        await expect(teamMenu.invitePeople).toHaveAttribute('tabindex', '0');

        // * Verify menu items have accessible names
        await expect(teamMenu.invitePeople).toHaveAccessibleName('Invite people Add or invite people to the team');
        await expect(teamMenu.teamSettings).toHaveAccessibleName('Team settings');
        await expect(teamMenu.manageMembers).toHaveAccessibleName('Manage members');
        await expect(teamMenu.leaveTeam).toHaveAccessibleName('Leave team');
        await expect(teamMenu.createTeam).toHaveAccessibleName('Create a team');
        await expect(teamMenu.learnAboutTeams).toHaveAccessibleName('Learn about teams');
    },
);

/**
 * @objective Verify menu items with icons have proper visual indicators and alt text
 */
test(
    'verify visual indicators and icon accessibility',
    {tag: ['@accessibility', '@team_menu', '@visual_indicators']},
    async ({pw}) => {
        // # Initialize setup and make the user a team admin to see all menu items
        const {user, team, adminClient} = await pw.initSetup();
        await adminClient.updateTeamMemberSchemeRoles(team.id, user.id, true, true);

        // # Log in a user in new browser context
        const {channelsPage} = await pw.testBrowser.login(user);
        const sidebarLeft = channelsPage.sidebarLeft;
        const teamMenu = channelsPage.teamMenu;

        // # Visit a default channel page
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // # Click on team menu button to open the menu
        await sidebarLeft.teamMenuButton.click();

        // * Team menu should be visible
        await teamMenu.toBeVisible();

        // * Verify icons have aria-hidden attribute (decorative)
        const menuItems = [
            teamMenu.invitePeople,
            teamMenu.teamSettings,
            teamMenu.manageMembers,
            teamMenu.leaveTeam,
            teamMenu.createTeam,
            teamMenu.learnAboutTeams,
        ];

        for (const menuItem of menuItems) {
            // * Each menu item should contain an SVG icon with aria-hidden
            const icon = menuItem.locator('svg').first();
            await expect(icon).toHaveAttribute('aria-hidden', 'true');

            // * Menu item should have visible focus indicator on focus
            await menuItem.focus();

            // * Verify the menu item is focused and has focus-visible styles
            await pw.toBeFocusedWithFocusVisible(menuItem);
        }
    },
);
