// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @zephyr MM-T5930
 * @objective Verify admin can configure team-specific reviewers for content flagging
 * @precondition Admin user exists, test team exists, content flagging feature is enabled
 */
test('MM-T5930 Configure team-specific reviewers for content flagging', {tag: '@system_console'}, async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Create test team
    const testTeam = await adminClient.createTeam(pw.random.team());

    // # Create test user to add as reviewer
    const reviewerUser = await adminClient.createUser(pw.random.user(), '', '');

    // # Add reviewer to the test team
    await adminClient.addToTeam(testTeam.id, reviewerUser.id);

    // # Log in as admin
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Visit system console
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Content Flagging settings
    await systemConsolePage.sidebar.goToItem('Content Flagging');
    await pw.waitUntil(
        async () =>
            (await systemConsolePage.page.locator('.ContentFlaggingSettings').isVisible()) ||
            (await systemConsolePage.page.getByText('Enable content flagging').isVisible()),
    );

    // # Enable content flagging feature if not already enabled
    const enableToggle = systemConsolePage.page.getByTestId('EnableContentFlaggingtrue');
    const isEnabled = await enableToggle.isChecked();
    if (!isEnabled) {
        await enableToggle.click();
        await pw.wait(500);
    }

    // * Verify content flagging is enabled
    await expect(enableToggle).toBeChecked();

    // # Turn OFF "Same reviewers for all teams" toggle
    const sameReviewersFalseRadio = systemConsolePage.page.getByTestId('sameReviewersForAllTeams_false');
    await sameReviewersFalseRadio.click();
    await pw.wait(1000); // Wait for UI to update

    // * Verify "Configure content flagging per team" section appears
    const teamSpecificSection = systemConsolePage.page.locator('div.teamSpecificReviewerSection');
    await expect(teamSpecificSection).toBeVisible();

    // # Locate the first DataGrid row for the test team
    const firstDataGridRow = systemConsolePage.page.locator('div.DataGrid_row').first();
    await expect(firstDataGridRow).toBeVisible();

    // # Find the user search box in the first row
    const userSelectorControl = firstDataGridRow.locator('div.UserMultiSelector__control');
    await expect(userSelectorControl).toBeVisible();

    // # Click the user selector to open the dropdown
    const userSelectorInput = userSelectorControl.locator('div.UserMultiSelector__value-container');
    await userSelectorInput.click();
    await pw.wait(500);

    // # Search for the created reviewer user by email
    const searchInput = userSelectorControl.locator('input').first();
    await searchInput.fill(reviewerUser.email);
    await pw.wait(1000); // Wait for search results to load

    // # Click the user from the dropdown search list
    await systemConsolePage.page.getByRole('option', {name: new RegExp(reviewerUser.username)}).click();
    await pw.wait(500);

    // * Verify the user was added to the selector (check for the user pill, not the dropdown option)
    await expect(
        firstDataGridRow.locator('.UserProfilePill').getByText(reviewerUser.username, {exact: true}),
    ).toBeVisible();

    // # Toggle the enable button for that team row
    const enableToggleForTeam = firstDataGridRow.locator('button[class*="toggle"], input[type="checkbox"]').first();
    const isTeamEnabled = await enableToggleForTeam.isChecked().catch(() => false);
    if (!isTeamEnabled) {
        await enableToggleForTeam.click();
        await pw.wait(500);
    }

    // # Save the changes
    const saveButton = systemConsolePage.page.getByRole('button', {name: 'Save'});
    await saveButton.click();

    // # Wait for save to complete
    await pw.waitUntil(async () => {
        const buttonText = await saveButton.textContent();
        return buttonText === 'Save';
    });

    // * Verify settings are saved successfully (no error message)
    const errorMessage = systemConsolePage.page.locator('.error-message, [class*="error"]');
    await expect(errorMessage).not.toBeVisible();

    // # Navigate away to verify persistence
    await systemConsolePage.sidebar.goToItem('Users');
    await systemConsolePage.systemUsers.toBeVisible();

    // # Navigate back to Content Flagging
    await systemConsolePage.sidebar.goToItem('Content Flagging');
    await pw.waitUntil(async () => await systemConsolePage.page.getByText('Enable content flagging').isVisible());

    // * Verify content flagging is still enabled
    const enableToggleAfter = systemConsolePage.page.getByTestId('EnableContentFlaggingtrue');
    await expect(enableToggleAfter).toBeChecked();

    // * Verify "Same reviewers for all teams" is still OFF
    const sameReviewersFalseAfter = systemConsolePage.page.getByTestId('sameReviewersForAllTeams_false');
    await expect(sameReviewersFalseAfter).toBeChecked();

    // * Verify team-specific section is still visible
    const teamSpecificSectionAfter = systemConsolePage.page.locator('div.teamSpecificReviewerSection');
    await expect(teamSpecificSectionAfter).toBeVisible();

    // * Verify the reviewer is still configured for the team
    const firstRowAfter = systemConsolePage.page.locator('div.DataGrid_row').first();
    await expect(
        firstRowAfter.locator('.UserProfilePill').getByText(reviewerUser.username, {exact: true}),
    ).toBeVisible();
});
