// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {setupAndGetRandomUser} from './support';

test('MM-T5520-4 should reset the users password', async ({pw}) => {
    const {systemConsolePage} = await setupAndGetRandomUser(pw);

    const userRow = systemConsolePage.users.usersTable.getRowByIndex(0);

    // # Open menu and click Reset Password
    const actionMenu = await userRow.openActionMenu();
    await actionMenu.clickResetPassword();

    // # Enter a random password and click Reset
    await systemConsolePage.users.resetPasswordModal.fillPassword(pw.newTestPassword());
    await systemConsolePage.users.resetPasswordModal.reset();
});

test('MM-T5520-5 should change the users email', async ({pw}) => {
    const {getUser, systemConsolePage} = await setupAndGetRandomUser(pw);
    const newEmail = `${pw.random.id()}@example.com`;

    const userRow = systemConsolePage.users.usersTable.getRowByIndex(0);

    // # Open menu and click Update Email
    const actionMenu = await userRow.openActionMenu();
    await actionMenu.clickUpdateEmail();

    // # Enter new email and click Update
    await systemConsolePage.users.updateEmailModal.fillEmail(newEmail);
    await systemConsolePage.users.updateEmailModal.update();

    // * Verify that the email updated
    await expect(userRow.container.getByText(newEmail)).toBeVisible();
    expect((await getUser()).email).toEqual(newEmail);
});

test('MM-T5520-6 should revoke sessions', async ({pw}) => {
    const {systemConsolePage} = await setupAndGetRandomUser(pw);

    const userRow = systemConsolePage.users.usersTable.getRowByIndex(0);

    // # Open menu and revoke sessions
    const actionMenu = await userRow.openActionMenu();
    await actionMenu.clickRevokeSessions();

    // # Press confirm on the modal
    await systemConsolePage.users.confirmModal.confirm();

    // * Verify no error is displayed
    await expect(userRow.container.locator('.error')).not.toBeVisible();
});
