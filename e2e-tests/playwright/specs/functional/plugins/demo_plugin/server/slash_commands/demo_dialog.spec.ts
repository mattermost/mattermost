// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {sendDemoSlashCommand} from '../../helpers';

test('should open /dialog and post submit confirmation on submit', async ({pw}) => {
    // # Setup
    const {user, team} = await pw.initSetup();
    await pw.ensureDemoPlugin();

    // # Login
    const {app} = await pw.testBrowser.login(user);

    // # Navigate to Demo Plugin channel
    await app.channelsPage.goto({team, channel: {name: 'town-square'}});
    await expect(app.center.postCreate.message.container).toBeVisible();

    // # Send /dialog command
    const dialog = app.page.getByRole('dialog');
    await sendDemoSlashCommand(app, '/dialog');
    await expect(dialog).toBeVisible();

    // * Verify dialog opens with title "Test Title"
    await expect(dialog.getByRole('heading', {level: 1})).toContainText('Test Title');

    // # Fill required fields
    // Display Name already has default "default text" — overwrite
    await app.appsForm.field('realname').valueTextbox.fill('Test Input');
    await expect(app.appsForm.field('realname').valueTextbox).toHaveValue('Test Input');

    // Email and Password are required
    await app.appsForm.field('someemail').valueTextbox.fill('test@example.com');
    await expect(app.appsForm.field('someemail').valueTextbox).toHaveValue('test@example.com');
    await app.appsForm.field('somepassword').valueTextbox.fill('testpassword123');
    await expect(app.appsForm.field('somepassword').valueTextbox).toHaveValue('testpassword123');

    // Number is required
    await app.appsForm.field('somenumber').numberSpinButton.fill('42');
    await expect(app.appsForm.field('somenumber').numberSpinButton).toHaveValue('42');

    // Option Selector — required, no default (3rd combobox: User Selector, Channel Selector, Option Selector)
    await dialog.getByRole('combobox').nth(2).click();
    await expect(app.page.getByRole('option', {name: 'Option1'})).toBeVisible();
    await app.page.getByRole('option', {name: 'Option1'}).click();
    await expect(app.page.getByRole('option', {name: 'Option1'})).not.toBeVisible();

    // Required checkboxes
    await dialog.getByRole('checkbox', {name: 'Agree to the terms of service'}).check();
    await expect(dialog.getByRole('checkbox', {name: 'Agree to the terms of service'})).toBeChecked();
    await dialog.getByRole('checkbox', {name: 'Agree to the annoying terms of service'}).check();
    await expect(dialog.getByRole('checkbox', {name: 'Agree to the annoying terms of service'})).toBeChecked();

    // Radio Option Selector — required
    await dialog.getByRole('radio', {name: 'Option1'}).click();
    await expect(dialog.getByRole('radio', {name: 'Option1'})).toBeChecked();

    // # Submit the dialog
    await dialog.getByRole('button', {name: 'Submit'}).click();

    // * Verify the dialog closed and the submit post appears in the channel
    // Note: "Interative" is a typo in the demo plugin — not a test error
    await expect(dialog).not.toBeVisible();
    await expect(await app.center.postList.postList.itemWith({text: 'submitted an Interative Dialog'})).toBeVisible();
});

test('should post cancellation notification when /dialog is cancelled', async ({pw}) => {
    // # Setup
    const {user, team} = await pw.initSetup();
    await pw.ensureDemoPlugin();

    // # Login
    const {app} = await pw.testBrowser.login(user);

    // # Navigate to Demo Plugin channel
    await app.channelsPage.goto({team, channel: {name: 'town-square'}});
    await expect(app.center.postCreate.message.container).toBeVisible();

    // # Send /dialog command
    const dialog = app.page.getByRole('dialog');
    await sendDemoSlashCommand(app, '/dialog');
    await expect(dialog).toBeVisible();

    // * Verify dialog opens
    await expect(dialog.getByRole('heading', {level: 1})).toContainText('Test Title');
    await expect(dialog.getByRole('button', {name: 'Cancel'})).toBeVisible();
    await expect(dialog.getByRole('button', {name: 'Submit'})).toBeVisible();

    // # Cancel the dialog
    await dialog.getByRole('button', {name: 'Cancel'}).click();

    // * Verify the dialog closed and the cancellation post appears in the channel
    // Note: "Interative" is a typo in the demo plugin — not a test error
    await expect(dialog).not.toBeVisible();
    await expect(await app.center.postList.postList.itemWith({text: 'canceled an Interative Dialog'})).toBeVisible();
});

test('should show validation errors when required fields are submitted empty', async ({pw}) => {
    // # Setup
    const {user, team} = await pw.initSetup();
    await pw.ensureDemoPlugin();

    // # Login
    const {app} = await pw.testBrowser.login(user);

    // # Navigate to Demo Plugin channel
    await app.channelsPage.goto({team, channel: {name: 'town-square'}});
    await expect(app.center.postCreate.message.container).toBeVisible();

    // # Send /dialog command
    const dialog = app.page.getByRole('dialog');
    await sendDemoSlashCommand(app, '/dialog');
    await expect(dialog).toBeVisible();

    // * Verify dialog opens
    await expect(dialog.getByRole('heading', {level: 1})).toContainText('Test Title');

    // # Clear the Number field and submit
    await app.appsForm.field('somenumber').numberSpinButton.clear();
    await dialog.getByRole('button', {name: 'Submit'}).click();

    // * Verify dialog stays open with validation errors
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Please fix all field errors', {exact: true})).toBeVisible();
    // The field's validation message has no part of its own: it is read by its text inside the field's region.
    await expect(
        app.appsForm.field('somenumber').container.locator.getByText('This field is required.', {exact: true}),
    ).toBeVisible();
});

test('should show general error and keep dialog open on /dialog error submit', async ({pw}) => {
    // # Setup
    const {user, team} = await pw.initSetup();
    await pw.ensureDemoPlugin();

    // # Login
    const {app} = await pw.testBrowser.login(user);

    // # Navigate to Town Square
    await app.channelsPage.goto({team, channel: {name: 'town-square'}});
    await expect(app.center.postCreate.message.container).toBeVisible();

    // # Send /dialog error command
    const dialog = app.page.getByRole('dialog');
    await sendDemoSlashCommand(app, '/dialog error');
    await expect(dialog).toBeVisible();

    // * Verify dialog opens with title "Simple Dialog Test"
    await expect(dialog.getByRole('heading', {level: 1})).toContainText('Simple Dialog Test');
    await expect(dialog.getByRole('button', {name: 'Cancel'})).toBeVisible();
    await expect(dialog.getByRole('button', {name: 'Submit Test'})).toBeVisible();

    // # Fill the optional field and submit
    await dialog.getByPlaceholder('Enter some text (optional)...').fill('sample test input');
    await dialog.getByRole('button', {name: 'Submit Test'}).click();

    // * Verify general error appears and dialog stays open
    await expect(dialog.getByText('some error', {exact: true})).toBeVisible();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByPlaceholder('Enter some text (optional)...')).toHaveValue('sample test input');
});

test('should show general error on /dialog error-no-elements confirm', async ({pw}) => {
    // # Setup
    const {user, team} = await pw.initSetup();
    await pw.ensureDemoPlugin();

    // # Login
    const {app} = await pw.testBrowser.login(user);

    // # Navigate to Town Square
    await app.channelsPage.goto({team, channel: {name: 'town-square'}});
    await expect(app.center.postCreate.message.container).toBeVisible();

    // # Send /dialog error-no-elements command
    const dialog = app.page.getByRole('dialog');
    await sendDemoSlashCommand(app, '/dialog error-no-elements');
    await expect(dialog).toBeVisible();

    // * Verify dialog opens with title "Sample Confirmation Dialog" and no form fields
    await expect(dialog.getByRole('heading', {level: 1})).toContainText('Sample Confirmation Dialog');
    await expect(dialog.getByRole('button', {name: 'Cancel'})).toBeVisible();
    await expect(dialog.getByRole('button', {name: 'Confirm'})).toBeVisible();
    await expect(dialog.getByRole('textbox')).not.toBeVisible();

    // # Click Confirm
    await dialog.getByRole('button', {name: 'Confirm'}).click();

    // * Verify general error appears and dialog stays open
    await expect(dialog.getByText('some error', {exact: true})).toBeVisible();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', {name: 'Cancel'})).toBeVisible();
    await expect(dialog.getByRole('button', {name: 'Confirm'})).toBeVisible();
});
