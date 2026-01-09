// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify admin can revoke all user sessions
 * @test_steps
 * 1. Admin navigates to System Console > Users
 * 2. Admin searches for test user by email
 * 3. Admin opens action menu and clicks "Revoke sessions"
 * 4. Admin confirms the revoke action in modal
 * 5. Verify no error is displayed
  * @zephyr MM-T5938
 */
test('MM-T5938 should revoke all user sessions', {tag: '@system-console'}, async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Create test user and add to team
    const testUser = await adminClient.createUser(await pw.random.user(), '', '');
    const team = await adminClient.createTeam(await pw.random.team());
    await adminClient.addToTeam(team.id, testUser.id);

    // # Login as admin
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Navigate to System Console
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Users section
    await systemConsolePage.sidebar.goToItem('Users');
    await systemConsolePage.systemUsers.toBeVisible();

    // # Search for test user by email
    await systemConsolePage.systemUsers.enterSearchText(testUser.email);

    // * Verify user appears in search results
    await systemConsolePage.systemUsers.verifyRowWithTextIsFound(testUser.email);

    // # Click action menu button
    await systemConsolePage.systemUsers.actionMenuButtons[0].click();

    // # Click "Revoke sessions"
    const revokeSessionsItem = await systemConsolePage.systemUsersActionMenus[0].getMenuItem('Revoke sessions');
    await revokeSessionsItem.click();

    // # Confirm the revoke action in modal
    await systemConsolePage.confirmModal.confirm();

    // * Verify no error is displayed in the row
    const userRow = await systemConsolePage.systemUsers.getNthRow(1);
    expect(await userRow.innerHTML()).not.toContain('class="error"');
});
