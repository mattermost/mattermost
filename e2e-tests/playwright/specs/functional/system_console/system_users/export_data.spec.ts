// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test.fixme('MM-T5522 Should begin export of data when export button is pressed', async ({pw}) => {
    test.slow();

    // # Skip test if no license
    await pw.skipIfNoLicense();

    const {adminUser} = await pw.initSetup();
    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Log in as admin
    const {page, channelsPage, systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Visit system console
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Users section
    await systemConsolePage.sidebar.goToItem('Users');
    await systemConsolePage.systemUsers.toBeVisible();

    // # Change the export pw.duration to 30 days
    await systemConsolePage.systemUsers.dateRangeSelectorMenuButton.click();
    await systemConsolePage.systemUsersDateRangeMenu.clickMenuItem('All time');

    // # Click Export button and confirm the modal
    await systemConsolePage.systemUsers.exportButton.click();
    await systemConsolePage.exportModal.confirm();

    // # Change the export pw.duration to all time
    await systemConsolePage.systemUsers.dateRangeSelectorMenuButton.click();
    await systemConsolePage.systemUsersDateRangeMenu.clickMenuItem('Last 30 days');

    // # Click Export button and confirm the modal
    await systemConsolePage.systemUsers.exportButton.click();
    await systemConsolePage.exportModal.confirm();

    // # Click Export again button and confirm the modal
    await systemConsolePage.systemUsers.exportButton.click();
    await systemConsolePage.exportModal.confirm();

    // * Verify that we are told that one is already running
    expect(page.getByText('Export is in progress')).toBeVisible();

    // # Go back to Channels and open the system bot DM
    channelsPage.goto('ad-1/messages', '@system-bot');
    await channelsPage.centerView.toBeVisible();

    // * Verify that we have started the export and that the second one is running second
    const lastPost = await channelsPage.getLastPost();
    await lastPost.toContain('export of user data for the last 30 days');

    // * Wait until the first export finishes
    await channelsPage.centerView.waitUntilLastPostContains('contains user data for all time', pw.duration.half_min);

    // * Wait until the second export finishes
    await channelsPage.centerView.waitUntilLastPostContains(
        'contains user data for the last 30 days',
        pw.duration.half_min,
    );
});
