// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify admin can update user's email address
 * @test_steps
 * 1. Admin navigates to System Console > Users
 * 2. Admin searches for test user by current email
 * 3. Admin opens action menu and clicks "Update email"
 * 4. Admin enters new valid email address
 * 5. Admin saves changes
 * 6. Verify email updated in UI and via API
 * 7. Verify old email search returns no results
 * 8. Verify new email search finds the user
  * @zephyr MM-T5936
 */
test('MM-T5936 should update user email address', {tag: '@system-console'}, async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Create test user with known email
    const testUser = await adminClient.createUser(await pw.random.user(), '', '');
    const oldEmail = testUser.email;
    const newEmail = `${await pw.random.id()}@example.com`;

    // # Login as admin
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Navigate to System Console
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Users section
    await systemConsolePage.sidebar.goToItem('Users');
    await systemConsolePage.systemUsers.toBeVisible();

    // # Search for test user by current email
    await systemConsolePage.systemUsers.enterSearchText(oldEmail);

    // * Verify user appears in search results
    await systemConsolePage.systemUsers.verifyRowWithTextIsFound(oldEmail);

    // # Click action menu button
    await systemConsolePage.systemUsers.actionMenuButtons[0].click();

    // # Click "Update email"
    const updateEmailItem = await systemConsolePage.systemUsersActionMenus[0].getMenuItem('Update email');
    await updateEmailItem.click();

    // # Enter new email
    const emailInput = systemConsolePage.page.locator('input[type="email"]');
    await emailInput.fill(newEmail);

    // # Click Save button (use clickResetButton which works for update email modal)
    await systemConsolePage.clickResetButton();

    // * Verify modal closes (email input is detached)
    await emailInput.waitFor({state: 'detached', timeout: 10000});

    // * Verify via API that email was updated
    const updatedUser = await adminClient.getUser(testUser.id);
    expect(updatedUser.email).toBe(newEmail);

    // # Clear search
    await systemConsolePage.systemUsers.enterSearchText('');

    // # Search for user with old email
    await systemConsolePage.systemUsers.enterSearchText(oldEmail);

    // * Verify old email search returns no results (user not found)
    await systemConsolePage.systemUsers.verifyRowWithTextIsNotFound(oldEmail);

    // # Clear search
    await systemConsolePage.systemUsers.enterSearchText('');

    // # Search for user with new email
    await systemConsolePage.systemUsers.enterSearchText(newEmail);

    // * Verify new email search finds the user
    await systemConsolePage.systemUsers.verifyRowWithTextIsFound(newEmail);

    // * Verify user row displays new email
    const userRow = await systemConsolePage.systemUsers.getNthRow(1);
    await expect(userRow).toContainText(newEmail);
});
