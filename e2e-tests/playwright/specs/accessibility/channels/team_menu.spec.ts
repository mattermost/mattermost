// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {focusVisible} from './focus_support';

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

        // # Create an open team the user is not on, since other specs may already have left one on the server
        const openTeam = await pw.random.team('open-team', 'Open Team');
        await adminClient.createTeam({...openTeam, allow_open_invite: true});

        // # Log in a user in new browser context
        const {app, page} = await pw.testBrowser.login(user);
        const header = app.lhs.header;
        const teamMenu = app.lhs.teamMenu;

        // # Visit a default channel page
        await app.teamPage.goto({team});
        await expect(app.center.composer).toBeVisible();
        await expect(app.center.postCreate.message.container).toBeVisible();

        // # Set focus on team menu button and press Enter to open the menu
        await header.openTeamMenuButton.focus();
        await page.keyboard.press('Enter');

        await expect(teamMenu).toBeVisible();
        await pw.logFocusedElement(page);

        // * Team menu should be visible, list "Join another team", and focus the first menu item - "Invite people"
        await expect(teamMenu).toBeVisible();
        await expect(teamMenu.joinAnotherTeamMenuItem).toBeVisible();
        await expect.poll(() => focusVisible(teamMenu.invitePeopleMenuItem)).toBe(true);

        // # Press ArrowDown to move focus to "Team settings" menu item
        await page.keyboard.press('ArrowDown');
        await expect.poll(() => focusVisible(teamMenu.teamSettingsMenuItem)).toBe(true);

        // # Press ArrowDown to move focus to "Manage members" menu item
        await page.keyboard.press('ArrowDown');
        await expect.poll(() => focusVisible(teamMenu.membersMenuItem)).toBe(true);

        // # Press ArrowDown to move focus to "Leave team" menu item
        await page.keyboard.press('ArrowDown');
        await expect.poll(() => focusVisible(teamMenu.leaveTeamMenuItem)).toBe(true);

        // # Press ArrowDown to move focus to "Join another team" menu item
        await page.keyboard.press('ArrowDown');
        await expect.poll(() => focusVisible(teamMenu.joinAnotherTeamMenuItem)).toBe(true);

        // # Press ArrowDown to move focus to "Create a team" menu item
        await page.keyboard.press('ArrowDown');
        await expect.poll(() => focusVisible(teamMenu.createTeamMenuItem)).toBe(true);

        // # Press ArrowDown to move focus to "Learn about teams" menu item
        await page.keyboard.press('ArrowDown');
        await expect.poll(() => focusVisible(teamMenu.learnAboutTeamsMenuItem)).toBe(true);
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
        const {user, team} = await pw.initSetup();
        const {app, page} = await pw.testBrowser.login(user);
        const header = app.lhs.header;
        const teamMenu = app.lhs.teamMenu;

        // # Visit a default channel page
        await app.teamPage.goto({team});
        await expect(app.center.composer).toBeVisible();
        await expect(app.center.postCreate.message.container).toBeVisible();

        // # Set focus on team menu button and press Enter to open the menu
        await header.openTeamMenuButton.focus();
        await page.keyboard.press('Enter');

        // * Team menu should be visible and focus should be on first menu item
        await expect(teamMenu).toBeVisible();
        await expect.poll(() => focusVisible(teamMenu.invitePeopleMenuItem)).toBe(true);

        // # Press Tab to exit menu and move to next focusable element outside menu
        await page.keyboard.press('Tab');

        // * Team menu should be closed and focus should move to next focusable element
        await expect(teamMenu).not.toBeVisible();

        // * Focus should be on the next focusable element - "Browse or create channels" button
        await expect(header.openTeamMenuButton).not.toBeFocused();
        await expect(header.openBrowseOrAddMenuButton).toBeFocused();
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
        const {app, page} = await pw.testBrowser.login(user);
        const header = app.lhs.header;
        const teamMenu = app.lhs.teamMenu;

        // # Visit a default channel page
        await app.teamPage.goto({team});
        await expect(app.center.composer).toBeVisible();
        await expect(app.center.postCreate.message.container).toBeVisible();

        // # Click on team menu button to open the menu
        await header.openTeamMenuButton.focus();
        await page.keyboard.press('Enter');

        // * Team menu should be visible
        await expect(teamMenu).toBeVisible();

        // # Set focus on "Team settings" menu item and press Enter
        await teamMenu.teamSettingsMenuItem.focus();
        await page.keyboard.press('Enter');

        // * Team settings modal should open (wait for navigation or modal)
        await expect(app.teamSettingsModal).toBeVisible();

        // # Close the modal using Escape key
        await page.keyboard.press('Escape');

        await expect(app.teamSettingsModal).not.toBeVisible();

        // # Reopen team menu
        await header.openTeamMenuButton.focus();
        await page.keyboard.press('Enter');
        await expect(teamMenu).toBeVisible();

        // # Set focus on "Learn about teams" menu item and press Space
        await teamMenu.invitePeopleMenuItem.focus();
        await page.keyboard.press(' ');

        // * Should navigate to learn about teams documentation or open modal
        const invitePeopleModal = app.invitationModal;
        await expect(invitePeopleModal).toBeVisible();
        await expect(invitePeopleModal.invite.titleText).toContainText(team.display_name);
    },
);

/**
 * @objective Verify Escape key closes the team menu
 */
test('close menu using Escape key', {tag: ['@accessibility', '@team_menu', '@keyboard_navigation']}, async ({pw}) => {
    // # Create and sign in a new user
    const {user, team} = await pw.initSetup();
    const {app, page} = await pw.testBrowser.login(user);
    const header = app.lhs.header;
    const teamMenu = app.lhs.teamMenu;

    // # Visit a default channel page
    await app.teamPage.goto({team});
    await expect(app.center.composer).toBeVisible();
    await expect(app.center.postCreate.message.container).toBeVisible();

    // # Click on team menu button to open the menu
    await header.openTeamMenuButton.clickTo(teamMenu);

    // * Team menu should be visible
    await expect(teamMenu).toBeVisible();

    // # Press Escape key
    await page.keyboard.press('Escape');

    // * Team menu should be closed
    await expect(teamMenu).not.toBeVisible();

    // * Focus should return to the team menu button
    await expect.poll(() => focusVisible(header.openTeamMenuButton)).toBe(true);
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
        const {app, page} = await pw.testBrowser.login(user);
        const header = app.lhs.header;
        const teamMenu = app.lhs.teamMenu;

        // # Visit a default channel page
        await app.teamPage.goto({team});
        await expect(app.center.composer).toBeVisible();
        await expect(app.center.postCreate.message.container).toBeVisible();

        // # Click on team menu button to open the menu
        await header.openTeamMenuButton.clickTo(teamMenu);

        // * Team menu should be visible
        await expect(teamMenu).toBeVisible();

        // * Verify aria snapshot of team menu structure
        await expect(teamMenu).toMatchAriaSnapshot();

        // # Analyze the team menu for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page, {disableColorContrast: true})
            .include('[role="menu"]')
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
        const {app} = await pw.testBrowser.login(user);
        const header = app.lhs.header;
        const teamMenu = app.lhs.teamMenu;

        // # Visit a default channel page
        await app.teamPage.goto({team});
        await expect(app.center.composer).toBeVisible();
        await expect(app.center.postCreate.message.container).toBeVisible();

        // # Click on team menu button to open the menu
        await header.openTeamMenuButton.clickTo(teamMenu);

        // * Team menu should be visible
        await expect(teamMenu).toBeVisible();

        // * Verify menu container has correct role
        await expect(teamMenu).toHaveAttribute('role', 'menu');

        // * Verify menu items have correct roles and attributes
        await expect(teamMenu.invitePeopleMenuItem).toHaveAttribute('role', 'menuitem');
        await expect(teamMenu.invitePeopleMenuItem).toHaveAttribute('aria-haspopup', 'dialog');

        await expect(teamMenu.teamSettingsMenuItem).toHaveAttribute('role', 'menuitem');
        await expect(teamMenu.teamSettingsMenuItem).toHaveAttribute('aria-haspopup', 'dialog');

        await expect(teamMenu.membersMenuItem).toHaveAttribute('role', 'menuitem');
        await expect(teamMenu.membersMenuItem).toHaveAttribute('aria-haspopup', 'dialog');

        await expect(teamMenu.leaveTeamMenuItem).toHaveAttribute('role', 'menuitem');
        await expect(teamMenu.leaveTeamMenuItem).toHaveAttribute('aria-haspopup', 'dialog');

        await expect(teamMenu.createTeamMenuItem).toHaveAttribute('role', 'menuitem');

        await expect(teamMenu.learnAboutTeamsMenuItem).toHaveAttribute('role', 'menuitem');

        // * Verify menu items are focusable
        await expect(teamMenu.invitePeopleMenuItem).toHaveAttribute('tabindex', '0');

        // * Verify menu items have accessible names
        await expect(teamMenu.invitePeopleMenuItem).toHaveAccessibleName(
            'Invite people Add or invite people to the team',
        );
        await expect(teamMenu.teamSettingsMenuItem).toHaveAccessibleName('Team settings');
        await expect(teamMenu.membersMenuItem).toHaveAccessibleName('Manage members');
        await expect(teamMenu.leaveTeamMenuItem).toHaveAccessibleName('Leave team');
        await expect(teamMenu.createTeamMenuItem).toHaveAccessibleName('Create a team');
        await expect(teamMenu.learnAboutTeamsMenuItem).toHaveAccessibleName('Learn about teams');
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
        const {app} = await pw.testBrowser.login(user);
        const header = app.lhs.header;
        const teamMenu = app.lhs.teamMenu;

        // # Visit a default channel page
        await app.teamPage.goto({team});
        await expect(app.center.composer).toBeVisible();
        await expect(app.center.postCreate.message.container).toBeVisible();

        // # Click on team menu button to open the menu
        await header.openTeamMenuButton.clickTo(teamMenu);

        // * Team menu should be visible
        await expect(teamMenu).toBeVisible();

        // * Verify icons have aria-hidden attribute (decorative)
        const menuItems = [
            teamMenu.invitePeopleMenuItem,
            teamMenu.teamSettingsMenuItem,
            teamMenu.membersMenuItem,
            teamMenu.leaveTeamMenuItem,
            teamMenu.createTeamMenuItem,
            teamMenu.learnAboutTeamsMenuItem,
        ];

        // A key press puts the page in keyboard mode, so script focus() shows the focus ring like a Tab would.
        await app.page.keyboard.press('Shift');
        await expect(teamMenu).toBeVisible();

        for (const menuItem of menuItems) {
            // * Each menu item should contain an SVG icon with aria-hidden
            // Decorative icons have no generated member; inspect only this menu item's child.
            const icon = menuItem.locator.locator('svg').first();
            await expect(icon).toHaveAttribute('aria-hidden', 'true');

            // * Menu item should have visible focus indicator on focus
            await menuItem.focus();

            // * Verify the menu item is focused and has focus-visible styles
            await expect.poll(() => focusVisible(menuItem)).toBe(true);
        }
    },
);
