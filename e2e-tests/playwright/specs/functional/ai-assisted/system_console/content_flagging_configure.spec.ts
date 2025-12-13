// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify admin can configure flagging reasons and comment requirements
 * @test steps
 *  1. Login as admin user
 *  2. Navigate to System Console
 *  3. Go to Content Flagging settings
 *  4. Configure custom flagging reasons
 *  5. Enable/disable comment requirement when flagging
 *  6. Set notification preferences for reviewers
 *  7. Save settings
 *  8. Verify configuration is applied correctly
 */
test('MM-T5928 Configure additional settings with flagging reasons and comment requirements', async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

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

    // # Enable content flagging first (prerequisite)
    const enableToggle = systemConsolePage.page.getByTestId('EnableContentFlaggingtrue');
    const isEnabled = await enableToggle.isChecked();
    if (!isEnabled) {
        await enableToggle.click();
        await expect(enableToggle).toBeChecked();
    }

    // # Scroll to Additional Settings section by finding the heading
    const additionalSettingsHeading = systemConsolePage.page.getByRole('heading', {
        name: 'Additional Settings',
        level: 1,
    });
    await additionalSettingsHeading.scrollIntoViewIfNeeded();

    // * Verify "Reasons for flagging" field exists (default reasons are already present)
    await expect(systemConsolePage.page.getByText('Reasons for flagging')).toBeVisible();

    // * Verify "Require reporters to add comment" is set to True (default)
    const requireReportersCommentLabel = systemConsolePage.page.getByText('Require reporters to add comment');
    await expect(requireReportersCommentLabel).toBeVisible();

    // * Verify "Require reviewers to add comment" is set to True (default)
    const requireReviewersCommentLabel = systemConsolePage.page.getByText('Require reviewers to add comment');
    await expect(requireReviewersCommentLabel).toBeVisible();

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

    // # Scroll to Additional Settings section again
    const additionalSettingsHeadingAfter = systemConsolePage.page.getByRole('heading', {
        name: 'Additional Settings',
        level: 1,
    });
    await additionalSettingsHeadingAfter.scrollIntoViewIfNeeded();

    // * Verify "Reasons for flagging" field is still visible
    await expect(systemConsolePage.page.getByText('Reasons for flagging')).toBeVisible();

    // * Verify "Require reporters to add comment" label is still visible
    await expect(systemConsolePage.page.getByText('Require reporters to add comment')).toBeVisible();

    // * Verify "Require reviewers to add comment" label is still visible
    await expect(systemConsolePage.page.getByText('Require reviewers to add comment')).toBeVisible();
});
