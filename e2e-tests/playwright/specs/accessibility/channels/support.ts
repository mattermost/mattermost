// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PlaywrightExtended} from '@mattermost/playwright-lib';

/**
 * Shared helpers for accessibility specs directly under `accessibility/channels/`.
 *
 * These wrap common prologues used by the dialog and team-menu specs so that
 * each spec only has to describe what makes it unique.
 */

/**
 * Rules disabled by settings-sidebar-level accessibility scans (theme, account).
 *
 * `aria-required-children` and `aria-required-parent` fail due to the way
 * plugin setting tabs are grouped together in the LHS.
 */
export const SETTINGS_SIDEBAR_DISABLED_RULES = [
    'color-contrast',

    // Known issue: These fail due to the way we've grouped plugin setting tabs together in the LHS
    'aria-required-children',
    'aria-required-parent',
];

/**
 * Initialize setup, optionally promote the created user to team admin
 * (required to see all team menu items), log in, and visit the default
 * channel page.
 *
 * Used by the `team_menu_*` specs to reach the point where the team menu
 * button is visible.
 */
export async function setupUserOnChannelsWithTeamMenu(pw: PlaywrightExtended, options: {asTeamAdmin?: boolean} = {}) {
    // # Initialize setup
    const {user, team, adminClient} = await pw.initSetup();

    if (options.asTeamAdmin) {
        // # Make the user a team admin to see all menu items
        await adminClient.updateTeamMemberSchemeRoles(team.id, user.id, true, true);
    }

    // # Log in a user in new browser context
    const {page, channelsPage} = await pw.testBrowser.login(user);
    const sidebarLeft = channelsPage.sidebarLeft;
    const teamMenu = channelsPage.teamMenu;

    // # Visit a default channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    return {user, team, adminClient, page, channelsPage, sidebarLeft, teamMenu};
}

/**
 * Initialize setup for a license-gated dialog test: skip when no license,
 * log in as the given actor (admin or regular user) and visit the
 * team's town-square channel.
 *
 * Used by the dialog specs (invite_people, browse_channels, direct_messages,
 * add_people_to_channel) which all open a modal from town-square.
 */
export async function setupDialogOnTownSquare(pw: PlaywrightExtended, options: {asAdmin?: boolean} = {}) {
    // # Skip test if no license
    await pw.skipIfNoLicense();

    // # Initialize setup
    const {team, user, adminUser, adminClient} = await pw.initSetup();

    // # Log in as the chosen actor in new browser context
    const actor = options.asAdmin ? adminUser : user;
    const {page, channelsPage} = await pw.testBrowser.login(actor);

    // # Visit town-square channel
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    return {team, user, adminUser, adminClient, page, channelsPage};
}
