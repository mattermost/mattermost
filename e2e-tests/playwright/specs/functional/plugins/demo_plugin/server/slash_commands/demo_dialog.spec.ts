// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {setupDemoPlugin} from '../../helpers';

test('should open /dialog and post submit confirmation on submit', async ({pw}) => {
    // 1. Setup
    const {adminClient, user, team} = await pw.initSetup();
    await setupDemoPlugin(adminClient, pw);

    // 2. Login
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // 3. Navigate to Demo Plugin channel
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // 4. Send /dialog command
    await channelsPage.centerView.postCreate.input.fill('/dialog');
    await channelsPage.centerView.postCreate.sendMessage();

    // 5. Confirm dialog opens with title "Test Title"
    const dialog = channelsPage.page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', {level: 1})).toContainText('Test Title');

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
    // 1. Setup
    const {adminClient, user, team} = await pw.initSetup();
    await setupDemoPlugin(adminClient, pw);

    // 2. Login
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // 3. Navigate to Demo Plugin channel
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // 4. Send /dialog command
    await channelsPage.centerView.postCreate.input.fill('/dialog');
    await channelsPage.centerView.postCreate.sendMessage();

    // 5. Confirm dialog opens
    const dialog = channelsPage.page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', {level: 1})).toContainText('Test Title');
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

test('should show validation errors when required fields are submitted empty', async ({pw}) => {
    // 1. Setup
    const {adminClient, user, team} = await pw.initSetup();
    await setupDemoPlugin(adminClient, pw);

    // 2. Login
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // 3. Navigate to Demo Plugin channel
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // 4. Send /dialog command
    await channelsPage.centerView.postCreate.input.fill('/dialog');
    await channelsPage.centerView.postCreate.sendMessage();

    // 5. Confirm dialog opens
    const dialog = channelsPage.page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', {level: 1})).toContainText('Test Title');

    // 6. Clear the Number field and submit
    await dialog.getByTestId('somenumbernumber').clear();
    await dialog.getByRole('button', {name: 'Submit'}).click();

    // 7. Verify dialog stays open with validation errors
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Please fix all field errors', {exact: true})).toBeVisible();
    await expect(dialog.getByTestId('somenumber').getByText('This field is required.', {exact: true})).toBeVisible();
});

test('should show general error and keep dialog open on /dialog error submit', async ({pw}) => {
    // 1. Setup
    const {adminClient, user, team} = await pw.initSetup();
    await setupDemoPlugin(adminClient, pw);

    // 2. Login
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // 3. Navigate to Town Square
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // 4. Send /dialog error command
    await channelsPage.centerView.postCreate.input.fill('/dialog error');
    await channelsPage.centerView.postCreate.sendMessage();

    // 5. Confirm dialog opens with title "Simple Dialog Test"
    const dialog = channelsPage.page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', {level: 1})).toContainText('Simple Dialog Test');
    await expect(dialog.getByRole('button', {name: 'Cancel'})).toBeVisible();
    await expect(dialog.getByRole('button', {name: 'Submit Test'})).toBeVisible();

    // 6. Fill the optional field and submit
    await dialog.getByPlaceholder('Enter some text (optional)...').fill('sample test input');
    await dialog.getByRole('button', {name: 'Submit Test'}).click();

    // 7. Verify general error appears and dialog stays open
    await expect(dialog.getByText('some error', {exact: true})).toBeVisible();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByPlaceholder('Enter some text (optional)...')).toHaveValue('sample test input');
});

test('should show general error on /dialog error-no-elements confirm', async ({pw}) => {
    // 1. Setup
    const {adminClient, user, team} = await pw.initSetup();
    await setupDemoPlugin(adminClient, pw);

    // 2. Login
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // 3. Navigate to Town Square
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // 4. Send /dialog error-no-elements command
    await channelsPage.centerView.postCreate.input.fill('/dialog error-no-elements');
    await channelsPage.centerView.postCreate.sendMessage();

    // 5. Confirm dialog opens with title "Sample Confirmation Dialog" and no form fields
    const dialog = channelsPage.page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', {level: 1})).toContainText('Sample Confirmation Dialog');
    await expect(dialog.getByRole('button', {name: 'Cancel'})).toBeVisible();
    await expect(dialog.getByRole('button', {name: 'Confirm'})).toBeVisible();
    await expect(dialog.getByRole('textbox')).not.toBeVisible();

    // 6. Click Confirm
    await dialog.getByRole('button', {name: 'Confirm'}).click();

    // 7. Verify general error appears and dialog stays open
    await expect(dialog.getByText('some error', {exact: true})).toBeVisible();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', {name: 'Cancel'})).toBeVisible();
    await expect(dialog.getByRole('button', {name: 'Confirm'})).toBeVisible();
});
