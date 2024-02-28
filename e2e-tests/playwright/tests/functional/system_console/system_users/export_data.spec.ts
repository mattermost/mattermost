// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';

import {test} from '@e2e-support/test_fixture';
import {duration} from '@e2e-support/util';
import {components} from '@e2e-support/ui/components';

test('MM-T5522 Should begin export of data when export button is pressed', async ({pw, pages}) => {
    test.slow();

    // # Skip test if no license
    await pw.skipIfNoLicense();

    const {adminUser} = await pw.initSetup();
    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Log in as admin
    const {page} = await pw.testBrowser.login(adminUser);

    // # Visit system console
    const systemConsolePage = new pages.SystemConsolePage(page);
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Users section
    await systemConsolePage.sidebar.goToItem('Users');
    await systemConsolePage.systemUsers.toBeVisible();

    // # Change the export duration to 30 days
    await systemConsolePage.systemUsers.dateRangeSelectorMenuButton.click();
    await systemConsolePage.systemUsersDateRangeMenu.clickMenuItem('All time');

    // # Click Export button and confirm the modal
    await systemConsolePage.systemUsers.exportButton.click();
    const confirmModal = new components.GenericConfirmModal(page, 'exportUserDataModal');
    await confirmModal.confirm();

    // # Change the export duration to all time
    await systemConsolePage.systemUsers.dateRangeSelectorMenuButton.click();
    await systemConsolePage.systemUsersDateRangeMenu.clickMenuItem('Last 30 days');

    // # Click Export button and confirm the modal
    await systemConsolePage.systemUsers.exportButton.click();
    await confirmModal.confirm();

    // # Click Export again button and confirm the modal
    await systemConsolePage.systemUsers.exportButton.click();
    await confirmModal.confirm();

    // * Verify that we are told that one is already running
    expect(page.getByText('Export is in progress')).toBeVisible();

    // # Go back to Channels and open the system bot DM
    const channelsPage = new pages.ChannelsPage(page);
    channelsPage.goto('ad-1/messages', '@system-bot');
    await channelsPage.centerView.toBeVisible();

    // * Verify that we have started the export and that the second one is running second
    const lastPost = await channelsPage.centerView.getLastPost();
    const postText = await lastPost.body.innerText();
    expect(postText).toContain('export of user data for the last 30 days');

    // * Wait until the first export finishes
    await channelsPage.centerView.waitUntilLastPostContains('contains user data for all time', duration.half_min);

    // * Wait until the second export finishes
    await channelsPage.centerView.waitUntilLastPostContains(
        'contains user data for the last 30 days',
        duration.half_min,
    );
});
