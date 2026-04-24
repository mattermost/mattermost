// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {setupUserOnChannelsWithTeamMenu} from './support';

/**
 * @objective Verify arrow key navigation through all menu items in the team menu
 */
test(
    'navigate using arrow keys between menu items',
    {tag: ['@accessibility', '@team_menu', '@keyboard_navigation']},
    async ({pw}) => {
        const {page, sidebarLeft, teamMenu} = await setupUserOnChannelsWithTeamMenu(pw, {asTeamAdmin: true});

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
        const {page, sidebarLeft, teamMenu} = await setupUserOnChannelsWithTeamMenu(pw);

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
        const {page, team, channelsPage, sidebarLeft, teamMenu} = await setupUserOnChannelsWithTeamMenu(pw, {
            asTeamAdmin: true,
        });

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
