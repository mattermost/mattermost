// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {settle, Api, type App, expect, openSystemUsers, test, Msg} from '@mattermost/playwright-lib';

/** The text of the center post list's last post. */
async function lastPostText(app: App) {
    const id = (await app.center.postList.postList.keys()).at(-1);
    return id ? app.center.postList.post({id}).locator.textContent() : '';
}

test.fixme('MM-T5522 Should begin export of data when export button is pressed', async ({pw}) => {
    test.slow();

    // # Skip test if no license
    await pw.skipIfNoLicense();

    const {adminUser} = await pw.initSetup();

    // # Log in as admin and open System Console > Users
    const app = await openSystemUsers(pw, adminUser);
    const {users} = app.admin;

    // # Change the export duration to All time, export and confirm
    await users.dateRange.container.clickTo(users.dateRangeMenu.allTimeMenuItem);
    await users.dateRangeMenu.allTimeMenuItem.click();
    await expect(users.dateRangeMenu.allTimeMenuItem).not.toBeVisible();
    await users.exportButton.clickTo(users.exportModal);
    await settle(users.exportModal.confirmButton, {wait: Api.StartBatchUsersExport}).click();

    // # Change the export duration to Last 30 days, export and confirm
    await users.dateRange.container.clickTo(users.dateRangeMenu.allTimeMenuItem);
    await users.dateRangeMenu.last30DaysMenuItem.click();
    await expect(users.dateRangeMenu.last30DaysMenuItem).not.toBeVisible();
    await users.exportButton.clickTo(users.exportModal);
    await settle(users.exportModal.confirmButton, {wait: Api.StartBatchUsersExport}).click();

    // # Export again and confirm
    await users.exportButton.clickTo(users.exportModal);
    await settle(users.exportModal.confirmButton, {wait: Api.StartBatchUsersExport}).click();

    // * Verify that we are told that one is already running
    await expect(users.exportErrorModal).toContainMessage(Msg.export_error_modal.inProgress.title);
    await users.exportErrorModal.confirmButton.click();
    await expect(users.exportErrorModal).not.toBeVisible();

    // # Go back to Channels and open the system bot DM
    await app.channelsPage.goto({team: 'ad-1', path: 'messages', channel: '@system-bot'});
    await expect(app.center.postList).toBeVisible();

    // * Verify that we have started the export and that the second one is running second
    await expect.poll(() => lastPostText(app)).toContain('export of user data for the last 30 days');

    // * Wait until the first export finishes
    await expect
        .poll(() => lastPostText(app), {timeout: pw.duration.half_min})
        .toContain('contains user data for all time');

    // * Wait until the second export finishes
    await expect
        .poll(() => lastPostText(app), {timeout: pw.duration.half_min})
        .toContain('contains user data for the last 30 days');
});
