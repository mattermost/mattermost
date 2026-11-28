// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {
    openSystemConsoleSection,
    settle,
    Api,
    expect,
    test,
    type App,
    type PlaywrightExtended,
    systemConsolePath,
    duration,
} from '@mattermost/playwright-lib';

test(
    'MM-63378 System Manager without team access permissions cannot view team details',
    {tag: ['@smoke', '@system_console']},
    async ({pw}) => {
        const {
            adminUser,
            adminClient,
            user: systemManagerUser,
            userClient: systemManagerClient,
            team,
        } = await pw.initSetup();

        // Update user with system_manager role
        await adminClient.updateUserRoles(systemManagerUser.id, 'system_user system_manager');

        // Create another team of which the user is not a member.
        const otherTeam = await adminClient.createTeam(await pw.random.team());

        // Configure the system manager with the default permissions (as admin).
        await setupSystemManagerPermission(pw, adminUser, 'reporting', 'reporting_team_statistics', 'Can edit');
        await setupSystemManagerPermission(pw, adminUser, 'user_management', 'user_management_teams', 'Can edit');

        // Re-login as the system manager (the admin login above replaced the page context)
        const {app} = await pw.testBrowser.login(systemManagerUser);

        // Navigate to Team Statistics and verify access to user's team
        await verifyTeamStatisticsAccess(app, team);

        // Select the other team and verify access
        await expectTeamStatistics(app, otherTeam);

        // Verify the user has API access to the otherTeam.
        const fetchedOtherTeam = await systemManagerClient.getTeam(otherTeam.id);
        expect(fetchedOtherTeam.id).toEqual(otherTeam.id);

        // Configure the system manager without access to team user management
        await setupSystemManagerPermission(pw, adminUser, 'user_management', 'user_management_teams', 'No access');

        // Re-login as the system manager again after permission change
        const {app: app2} = await pw.testBrowser.login(systemManagerUser);

        // Navigate to Team Statistics and verify access to user's team
        await verifyTeamStatisticsAccess(app2, team);

        // Verify the user has no API access to the otherTeam.
        let apiError: Error | null = null;
        try {
            await systemManagerClient.getTeam(otherTeam.id);
        } catch (error) {
            apiError = error as Error;
        }
        expect(apiError).not.toBeNull();
        expect(apiError?.message).toContain('You do not have the appropriate permissions');
    },
);

/** Picks a team on the Team Statistics page and checks its header names it. */
const expectTeamStatistics = async (app: App, team: Team) => {
    const {statistics} = app.admin;
    await statistics.teamCombobox.choose(team.display_name);
    await expect(statistics.headerText).toContainText(team.display_name);
};

// Helper function to navigate to Team Statistics and verify team access
const verifyTeamStatisticsAccess = async (app: App, team: Team) => {
    await openSystemConsoleSection(app);
    await app.admin.sidebar.category('reporting').section('team_statistics').titleLink.click();
    await expect(app.admin.statistics.teamCombobox).toBeVisible();
    await expectTeamStatistics(app, team);
};

type PermissionValue = 'Can edit' | 'Read only' | 'No access';

// setupSystemManagerPermission configures the system manager with the given permission ("Can edit", "Read only",
// "No access") for the given section's subsection.
//
// We do this via the system console and not the API because this page has multiple queries to build up the
// final API call that are all ultimately part of the spec, and we want to test the effects of those, not
// merely a hand-created version of the same.
const setupSystemManagerPermission = async (
    pw: PlaywrightExtended,
    adminUser: UserProfile,
    sectionName: string,
    subsectionName: string,
    permission: PermissionValue,
) => {
    // # Log in as admin and open the System Manager role
    const {app} = await pw.testBrowser.login(adminUser);
    await openSystemConsoleSection(app, 'user_management/system_roles');
    await app.admin.roles.row('system_manager').editLink.click();
    const role = app.admin.role;
    await expect(role.nameText).toBeVisible();

    // # Show the section's subsections and set the subsection's access
    // A section opens already expanded when its subsections' access differs, so it may start as Show or as Hide.
    // Toggling until it reads Hide ends expanded from either start, without reading the state first.
    const toggle = role.section(sectionName).subsectionsToggleButton;
    await expect(toggle).toHaveText(/^(Show|Hide)/);
    await expect(async () => {
        await toggle.click();
        await expect(toggle).toHaveText(/^Hide/, {timeout: duration.one_sec});
    }).toPass({timeout: duration.half_min});
    const menu = role.section(subsectionName).accessMenu;
    const choice = {
        'Can edit': menu.canEditMenuItem,
        'Read only': menu.readOnlyMenuItem,
        'No access': menu.noAccessMenuItem,
    }[permission];
    await role.section(subsectionName).accessButton.clickTo(choice);
    await choice.click();
    await expect(role.section(subsectionName).accessLevelText).toHaveText(permission);

    // # Save, which returns to the roles list
    await settle(role.savePanel.saveButton, {wait: Api.PatchRole}).click();
    await expect(app.page).toHavePath(systemConsolePath('user_management/system_roles'));
};
