// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {setupUserOnChannelsWithTeamMenu} from './support';

/**
 * @objective Verify menu items have proper ARIA attributes for screen readers
 */
test(
    'verify ARIA attributes and screen reader support',
    {tag: ['@accessibility', '@team_menu', '@screen_reader']},
    async ({pw}) => {
        const {sidebarLeft, teamMenu} = await setupUserOnChannelsWithTeamMenu(pw, {asTeamAdmin: true});

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
        const {sidebarLeft, teamMenu} = await setupUserOnChannelsWithTeamMenu(pw, {asTeamAdmin: true});

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
