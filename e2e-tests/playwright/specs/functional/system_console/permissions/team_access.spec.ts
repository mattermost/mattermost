// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UserProfile} from '@mattermost/types/users';

import {expect, PlaywrightExtended, test} from '@mattermost/playwright-lib';

// setupSystemManagerRole configures the system manager with the given permission ("Can Edit", "Read only", "No access")
// for the given section and subsection (e.g. "permission_section_reporting_site_statistics" and "permission_section_reporting_team_statistics").
//
// We do this via the system console and not the API because this page has multiple queries to build up the
// final API call that are all ultimately part of the spec, and we want to test the effects of those, not
// merely a hand-created version of the same.
const setupDefaultSystemManagerRole = async (
    pw: PlaywrightExtended,
    adminUser: UserProfile,
    sectionTestId: string,
    subsectionTestId: string,
    permissionText: string,
) => {
    // Login as admin and navigate to System Console
    const {systemConsolePage: adminConsolePage} = await pw.testBrowser.login(adminUser);

    // Go to System Console
    await adminConsolePage.goto();

    // Login to the System Console and navigate to Delegated Granular Administration
    await adminConsolePage.sidebar.goToItem('Delegated Granular Administration');

    // Find the System Manager row in the table
    const systemManagerText = adminConsolePage.page.getByText('System Manager', {exact: true}).first();
    await expect(systemManagerText).toBeVisible();

    // Click on the System Manager text to go to its settings page
    await systemManagerText.click();

    // Expand the section
    const sectionReporting = adminConsolePage.page.locator(`data-testid=${sectionTestId}`);
    const hideSubsectionsLink = sectionReporting.getByRole('button').filter({hasText: 'Hide'}).first();
    const showSubsectionsLink = sectionReporting.getByRole('button').filter({hasText: 'Show'}).first();

    // Check which one is visible and click if needed
    const isHideVisible = await hideSubsectionsLink.isVisible();
    const isShowVisible = !isHideVisible && (await showSubsectionsLink.isVisible());

    if (isShowVisible) {
        // Need to expand
        await showSubsectionsLink.click();
    }

    // Get the whole row
    const rowReporting = adminConsolePage.page.locator('.PermissionRow').filter({has: sectionReporting});
    await rowReporting.click();

    // Find the sub section
    const subsectionTeamStatistics = rowReporting.locator(`data-testid=${subsectionTestId}`);

    await subsectionTeamStatistics.click();

    // Look for dropdown button
    const dropdownButton = subsectionTeamStatistics.locator('button').first();

    // Click the button to open the dropdown menu
    await dropdownButton.click();

    // Click on the desired option in the dropdown
    const permissionOption = subsectionTeamStatistics.locator('.dropdown-menu').getByText(permissionText).first();
    await permissionOption.click();

    // Click Save button
    const saveButton = adminConsolePage.page.getByRole('button', {name: 'Save'}).first();
    await saveButton.click();

    // Wait for save operation to complete
    await adminConsolePage.page.waitForLoadState('networkidle');

    // Go back to the main console
    await adminConsolePage.goto();
    await adminConsolePage.page.waitForLoadState('networkidle');
};

test('MM-63378 System Manager without team access permissions cannot view team details', async ({pw}) => {
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
    const otherTeam = await adminClient.createTeam(pw.random.team());

    // Login as the user
    const {systemConsolePage} = await pw.testBrowser.login(systemManagerUser);

    // Configure the system manager with the default permissions.
    await setupDefaultSystemManagerRole(
        pw,
        adminUser,
        'permission_section_reporting',
        'permission_section_reporting_team_statistics',
        'Can edit',
    );
    await setupDefaultSystemManagerRole(
        pw,
        adminUser,
        'permission_section_user_management',
        'permission_section_user_management_teams',
        'Can edit',
    );

    // Verify the system manager has access to the site statistics for all teams
    await systemConsolePage.goto();

    // Navigate to Team Statistics
    await systemConsolePage.sidebar.goToItem('Team Statistics');

    // Wait for page to fully load
    await systemConsolePage.page.waitForLoadState('networkidle');

    // Find the team filter dropdown
    let teamFilterSelect = systemConsolePage.page.getByTestId('teamFilter');
    await expect(teamFilterSelect).toBeVisible();

    // Select the team by value
    await teamFilterSelect.selectOption({value: team.id});

    // Verify the text shows "Team Statistics for <team name>"
    let teamStatsHeading = systemConsolePage.page.getByText(`Team Statistics for ${team.display_name}`, {exact: true});
    await expect(teamStatsHeading).toBeVisible();

    // Select the other team by value
    await teamFilterSelect.selectOption({value: otherTeam.id});

    // Verify the text shows "Team Statistics for <team name>"
    const otherTeamStatsHeading = systemConsolePage.page.getByText(`Team Statistics for ${otherTeam.display_name}`, {
        exact: true,
    });
    await expect(otherTeamStatsHeading).toBeVisible();

    // Verify the user has API access to the otherTeam.
    const fetchedOtherTeam = await systemManagerClient.getTeam(otherTeam.id);
    expect(fetchedOtherTeam.id).toEqual(otherTeam.id);

    // Configure the system manager without access to team user management
    await setupDefaultSystemManagerRole(
        pw,
        adminUser,
        'permission_section_user_management',
        'permission_section_user_management_teams',
        'No access',
    );

    // Verify the system manager only has access to the site statistics for the team they belong to
    await systemConsolePage.goto();

    // Navigate to Team Statistics
    await systemConsolePage.sidebar.goToItem('Team Statistics');

    // Find the team filter dropdown
    teamFilterSelect = systemConsolePage.page.getByTestId('teamFilter');
    await expect(teamFilterSelect).toBeVisible();

    // Select the team by value
    await teamFilterSelect.selectOption({value: team.id});

    // Verify the text shows "Team Statistics for <team name>"
    teamStatsHeading = systemConsolePage.page.getByText(`Team Statistics for ${team.display_name}`, {exact: true});
    await expect(teamStatsHeading).toBeVisible();

    // Verify the user has no API access to the otherTeam.
    await expect(systemManagerClient.getTeam(otherTeam.id)).rejects.toThrow();
});
