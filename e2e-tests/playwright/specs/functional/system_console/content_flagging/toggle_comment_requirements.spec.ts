// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '@mattermost/playwright-lib';

/**
 * @objective Verify admin can configure comment requirements for reporters and reviewers
 * @test steps
 *  1. Navigate to Content Flagging (with feature enabled)
 *  2. Set Require Reporter Comment to true [data-testid="requireReporterComment_true"]
 *  3. Set Require Reviewer Comment to false [data-testid="requireReviewerComment_false"]
 *  4. Click Save
 *  5. Reload and verify both settings persisted correctly
 */
test('MM-TXXX Toggle comment requirements for reporters and reviewers', {tag: '@system_console'}, async ({pw}) => {
    // # Setup: Get admin user
    const {adminUser} = await pw.initSetup();

    // # Login and navigate to Content Flagging
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    await systemConsolePage.goto();
    await systemConsolePage.sidebar.goToItem('Site Configuration', 'Content Flagging');

    // # Enable Content Flagging first
    const enableToggle = systemConsolePage.page.getByTestId('EnableContentFlaggingtrue');
    await enableToggle.click();

    // # Set Require Reporter Comment to true
    const reporterCommentTrue = systemConsolePage.page.getByTestId('requireReporterComment_true');
    await reporterCommentTrue.click();

    // * Verify it's checked
    await expect(reporterCommentTrue).toBeChecked();

    // # Set Require Reviewer Comment to false
    const reviewerCommentFalse = systemConsolePage.page.getByTestId('requireReviewerComment_false');
    await reviewerCommentFalse.click();

    // * Verify it's checked
    await expect(reviewerCommentFalse).toBeChecked();

    // # Save settings
    const saveButton = systemConsolePage.page.locator('.admin-console-save .btn-primary');
    await saveButton.click();

    // * Wait for save to complete
    await pw.waitUntil(async () => (await saveButton.textContent()) === 'Save');

    // * Reload and verify both settings persisted correctly
    await systemConsolePage.page.reload();
    await expect(reporterCommentTrue).toBeChecked();
    await expect(reviewerCommentFalse).toBeChecked();
});
