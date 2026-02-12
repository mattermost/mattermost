// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UserProfile} from '@mattermost/types/users';

import {expect, PlaywrightExtended, SystemConsolePage, test} from '@mattermost/playwright-lib';

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
        await setupSystemManagerPermission(pw, adminUser, 'reporting', 'team_statistics', 'Can edit');
        await setupSystemManagerPermission(pw, adminUser, 'userManagement', 'teams', 'Can edit');

        // Re-login as the system manager (the admin login above replaced the page context)
        const {systemConsolePage} = await pw.testBrowser.login(systemManagerUser);

        // Verify the system manager has access to the site statistics for all teams
        await systemConsolePage.goto();

        // Navigate to Team Statistics and verify access to user's team
        await verifyTeamStatisticsAccess(systemConsolePage, team.id, team.display_name);

        // Select the other team by value and verify access
        await systemConsolePage.teamStatistics.selectTeamById(otherTeam.id);
        await systemConsolePage.teamStatistics.toHaveTeamHeader(otherTeam.display_name);

        // Verify the user has API access to the otherTeam.
        const fetchedOtherTeam = await systemManagerClient.getTeam(otherTeam.id);
        expect(fetchedOtherTeam.id).toEqual(otherTeam.id);

        // Configure the system manager without access to team user management
        await setupSystemManagerPermission(pw, adminUser, 'userManagement', 'teams', 'No access');

        // Re-login as the system manager again after permission change
        const {systemConsolePage: systemConsolePage2} = await pw.testBrowser.login(systemManagerUser);

        // Verify the system manager only has access to the site statistics for the team they belong to
        await systemConsolePage2.goto();

        // Navigate to Team Statistics and verify access to user's team
        await verifyTeamStatisticsAccess(systemConsolePage2, team.id, team.display_name);

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

// Helper function to navigate to Team Statistics and verify team access
const verifyTeamStatisticsAccess = async (
    systemConsolePage: SystemConsolePage,
    teamId: string,
    teamDisplayName: string,
) => {
    // Navigate to Team Statistics
    await systemConsolePage.sidebar.reporting.teamStatistics.click();
    await systemConsolePage.teamStatistics.toBeVisible();

    // Select the team by value
    await systemConsolePage.teamStatistics.selectTeamById(teamId);

    // Verify the text shows "Team Statistics for <team name>"
    await systemConsolePage.teamStatistics.toHaveTeamHeader(teamDisplayName);
};

type PermissionValue = 'Can edit' | 'Read only' | 'No access';

// setupSystemManagerRole configures the system manager with the given permission ("Can edit", "Read only", "No access")
// for the given section and subsection.
//
// We do this via the system console and not the API because this page has multiple queries to build up the
// final API call that are all ultimately part of the spec, and we want to test the effects of those, not
// merely a hand-created version of the same.
const setupSystemManagerPermission = async (
    pw: PlaywrightExtended,
    adminUser: UserProfile,
    sectionName: 'reporting' | 'userManagement',
    subsectionName: string,
    permission: PermissionValue,
) => {
    // Login as admin and navigate to System Console
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // Go to System Console
    await systemConsolePage.goto();

    // Navigate to Delegated Granular Administration
    await systemConsolePage.sidebar.delegatedGranularAdministration.click();
    await systemConsolePage.delegatedGranularAdministration.toBeVisible();

    // Click on the System Manager row to go to its settings page
    await systemConsolePage.delegatedGranularAdministration.adminRolesPanel.systemManager.clickEdit();
    await systemConsolePage.delegatedGranularAdministration.systemRoles.toBeVisible();

    // Get the section from privileges panel
    const section = systemConsolePage.delegatedGranularAdministration.systemRoles.privilegesPanel[sectionName];

    // Expand subsections if needed
    await section.expandSubsections();

    // Get the subsection and set permission
    const subsection = section.getSubsection(subsectionName);
    await subsection.setPermission(permission);

    // Save
    await systemConsolePage.delegatedGranularAdministration.systemRoles.save();

    // Wait for save to complete - successful save redirects to system_roles list
    await systemConsolePage.page.waitForURL('**/admin_console/user_management/system_roles');

    // Wait for the page to fully load
    await systemConsolePage.page.waitForLoadState('networkidle');
};
