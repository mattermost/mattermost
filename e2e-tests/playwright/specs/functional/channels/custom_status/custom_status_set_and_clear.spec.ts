// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, settle, test, Api, Msg} from '@mattermost/playwright-lib';

/**
 * @objective Verify a user can set a custom status with an expiry from the account menu, and clear it again.
 */
test('sets a custom status that clears after an hour, then clears it', {tag: '@custom_status'}, async ({pw}) => {
    const {team, user, userClient, townSquare: channel} = await pw.initSetup();
    const text = `In a meeting ${pw.random.id()}`;
    const customStatus = async () => {
        const me = await userClient.getMe();
        return me.props?.customStatus ? JSON.parse(me.props.customStatus) : null;
    };

    // # Log in and open the account menu's "Set a custom status"
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});
    await app.globalHeader.openAccountMenuButton.clickTo(app.globalHeader.accountMenu.nameMenuItem);
    const accountMenu = app.globalHeader.accountMenu;
    const modal = await accountMenu.setCustomStatusMenuItem.clickTo(app.customStatusModal);

    // # Type a status and choose to clear it after one hour
    await modal.textTextbox.fill(text);
    await modal.expiry.openButton.click();
    await expect(modal.expiry.menu.duration(0)).toBeVisible();
    const oneHour = await modal.expiry.menu.durationList.itemWith({
        message: Msg.custom_status.expiry_dropdown.one_hour,
    });
    await oneHour.click();
    await expect(modal.expiry.openButton).toContainMessage(Msg.custom_status.expiry_dropdown.one_hour);

    // # Set it
    await settle(modal.confirmButton, {wait: Api.UpdateUserCustomStatusMe}).click();

    // * The server has the status, with the one-hour duration
    await expect.poll(customStatus).toMatchObject({text, duration: 'one_hour'});

    // # Open it again from the account menu and clear it
    await app.globalHeader.openAccountMenuButton.clickTo(app.globalHeader.accountMenu.nameMenuItem);
    const menu = app.globalHeader.accountMenu;
    const edit = await menu.customStatusMenuItem.clickTo(app.customStatusModal);
    await expect(edit.textTextbox).toHaveValue(text);
    await settle(edit.cancelButton, {wait: Api.UnsetUserCustomStatusMe}).click();

    // * The server no longer has a custom status for the user
    await expect.poll(async () => (await customStatus())?.text ?? '').toBe('');
});
