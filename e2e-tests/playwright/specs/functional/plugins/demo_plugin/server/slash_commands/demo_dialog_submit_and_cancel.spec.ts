// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {openDemoDialog} from './support';

test('should open /dialog and post submit confirmation on submit', async ({pw}) => {
    // 1-5. Setup, login, navigate, send /dialog, confirm dialog opens with title "Test Title"
    const {channelsPage, dialog} = await openDemoDialog(pw, {expectedHeading: 'Test Title'});

    // 6. Fill required fields
    // Display Name already has default "default text" — overwrite
    await dialog.getByTestId('realnameinput').fill('Test Input');

    // Email and Password are required
    await dialog.getByTestId('someemailemail').fill('test@example.com');
    await dialog.getByTestId('somepasswordpassword').fill('testpassword123');

    // Number is required
    await dialog.getByTestId('somenumbernumber').fill('42');

    // Option Selector — required, no default (3rd combobox: User Selector, Channel Selector, Option Selector)
    await dialog.getByRole('combobox').nth(2).click();
    await channelsPage.page.getByRole('option', {name: 'Option1'}).click();

    // Required checkboxes
    await dialog.getByRole('checkbox', {name: 'Agree to the terms of service'}).check();
    await dialog.getByRole('checkbox', {name: 'Agree to the annoying terms of service'}).check();

    // Radio Option Selector — required
    await dialog.getByRole('radio', {name: 'Option1'}).click();

    // 7. Submit the dialog
    await dialog.getByRole('button', {name: 'Submit'}).click();
    await expect(dialog).not.toBeVisible();

    // 8. Verify the submit post appears in the channel
    // Note: "Interative" is a typo in the demo plugin — not a test error
    await expect(
        channelsPage.centerView.container.locator('p').filter({hasText: 'submitted an Interative Dialog'}),
    ).toBeVisible();
});

test('should post cancellation notification when /dialog is cancelled', async ({pw}) => {
    // 1-5. Setup, login, navigate, send /dialog, confirm dialog opens
    const {channelsPage, dialog} = await openDemoDialog(pw, {expectedHeading: 'Test Title'});

    await expect(dialog.getByRole('button', {name: 'Cancel'})).toBeVisible();
    await expect(dialog.getByRole('button', {name: 'Submit'})).toBeVisible();

    // 6. Cancel the dialog
    await dialog.getByRole('button', {name: 'Cancel'}).click();
    await expect(dialog).not.toBeVisible();

    // 7. Verify the cancellation post appears in the channel
    // Note: "Interative" is a typo in the demo plugin — not a test error
    await expect(
        channelsPage.centerView.container.locator('p').filter({hasText: 'canceled an Interative Dialog'}),
    ).toBeVisible();
});
