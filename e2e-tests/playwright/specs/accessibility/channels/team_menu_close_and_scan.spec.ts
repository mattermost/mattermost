// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {setupUserOnChannelsWithTeamMenu} from './support';

/**
 * @objective Verify Escape key closes the team menu
 */
test('close menu using Escape key', {tag: ['@accessibility', '@team_menu', '@keyboard_navigation']}, async ({pw}) => {
    const {page, sidebarLeft, teamMenu} = await setupUserOnChannelsWithTeamMenu(pw);

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
        const {page, teamMenu, sidebarLeft} = await setupUserOnChannelsWithTeamMenu(pw, {asTeamAdmin: true});

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
