// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

/**
 * @objective Verify admin can reset user's password
 * @test_steps
 * 1. Admin navigates to System Console > Users
 * 2. Admin searches for test user by email
 * 3. Admin opens action menu and clicks "Reset password"
 * 4. Admin enters new valid password
 * 5. Admin saves changes
 * 6. Verify modal closes successfully
  * @zephyr MM-T5937
 */
test('MM-T5937 should reset user password', {tag: '@system-console'}, async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Create test user and add to team
    const testUser = await adminClient.createUser(await pw.random.user(), '', '');
    const team = await adminClient.createTeam(await pw.random.team());
    await adminClient.addToTeam(team.id, testUser.id);
    const newPassword = `NewPassword${await pw.random.id()}!`;

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

    // # Click "Reset password"
    const resetPasswordItem = await systemConsolePage.systemUsersActionMenus[0].getMenuItem('Reset password');
    await resetPasswordItem.click();

    // # Enter new password
    const passwordInput = systemConsolePage.page.locator('input[type="password"]');
    await passwordInput.fill(newPassword);

    // # Click Save button
    await systemConsolePage.clickResetButton();

    // * Verify modal closes (password input is detached)
    await passwordInput.waitFor({state: 'detached', timeout: 10000});
});
