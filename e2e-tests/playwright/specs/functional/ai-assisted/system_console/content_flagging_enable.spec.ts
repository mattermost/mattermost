// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify admin can enable content flagging and add common reviewers
 * @test steps
 *  1. Login as admin user
 *  2. Navigate to System Console
 *  3. Go to Content Flagging settings
 *  4. Enable content flagging feature
 *  5. Add users as common reviewers
 *  6. Save settings
 *  7. Verify settings are saved successfully
 */
test('MM-T5927 Enable content flagging and configure common reviewers', async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Create test users to add as reviewers
    const reviewer1 = await adminClient.createUser(pw.random.user(), '', '');
    const reviewer2 = await adminClient.createUser(pw.random.user(), '', '');

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

    // # Enable content flagging feature
    const enableToggle = systemConsolePage.page.getByTestId('EnableContentFlaggingtrue');
    const isEnabled = await enableToggle.isChecked();
    if (!isEnabled) {
        await enableToggle.click();
    }

    // * Verify content flagging is enabled
    await expect(enableToggle).toBeChecked();

    // # "Same reviewers for all teams" is already enabled by default (True radio is checked)
    // We can verify it's selected or just proceed with adding reviewers

    // # Add first reviewer using the combobox input
    const reviewersCombobox = systemConsolePage.page.getByRole('combobox').first();
    await reviewersCombobox.click();
    await reviewersCombobox.fill(reviewer1.email);
    await pw.wait(1000); // Wait for search results
    await systemConsolePage.page.getByRole('option', {name: new RegExp(reviewer1.username)}).click();

    // # Add second reviewer
    await reviewersCombobox.click();
    await reviewersCombobox.fill(reviewer2.email);
    await pw.wait(1000); // Wait for search results
    await systemConsolePage.page.getByRole('option', {name: new RegExp(reviewer2.username)}).click();

    // # Save settings
    const saveButton = systemConsolePage.page.getByRole('button', {name: 'Save'});
    await saveButton.click();

    // # Wait for save to complete
    await pw.waitUntil(async () => {
        const buttonText = await saveButton.textContent();
        return buttonText === 'Save';
    });

    // * Verify settings are saved successfully (no error message)
    const errorMessage = systemConsolePage.page.locator('.error-message');
    await expect(errorMessage).not.toBeVisible();

    // # Navigate away and back to verify persistence
    await systemConsolePage.sidebar.goToItem('Users');
    await systemConsolePage.systemUsers.toBeVisible();

    await systemConsolePage.sidebar.goToItem('Content Flagging');
    await pw.waitUntil(async () => await systemConsolePage.page.getByText('Enable content flagging').isVisible());

    // * Verify content flagging is still enabled
    const enableToggleAfter = systemConsolePage.page.getByTestId('EnableContentFlaggingtrue');
    await expect(enableToggleAfter).toBeChecked();

    // * Verify reviewers are still configured
    await expect(systemConsolePage.page.getByText(reviewer1.username)).toBeVisible();
    await expect(systemConsolePage.page.getByText(reviewer2.username)).toBeVisible();
});
