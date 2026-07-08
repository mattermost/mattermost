// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {sendDemoSlashCommand, setupDemoPlugin} from '../../helpers';

test('should open /dialog and post submit confirmation on submit', async ({pw}) => {
    // Plugin installation can take up to 60 s; extend the test timeout to avoid
    // a premature timeout before the dialog even opens.
    test.setTimeout(120000);

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

    // 4. Send /dialog command (with one retry if the dialog doesn't appear).
    // Under CI load the plugin's slash-command handler can be slow to respond;
    // a single re-send recovers transient timeouts without masking real failures.
    // Re-apply guard: concurrent initSetup() resets PluginSettings (Plugins: {}) which
    // clears the demo plugin config; re-running setupDemoPlugin is fast when the plugin
    // is already active (alreadyActive guard skips reinstall).
    await setupDemoPlugin(adminClient, pw);
    const interactiveDialog = channelsPage.interactiveDialog;
    for (let attempt = 0; attempt < 4; attempt++) {
        await sendDemoSlashCommand(channelsPage.page, async () => {
            await channelsPage.centerView.postCreate.input.fill('/dialog');
            await channelsPage.centerView.postCreate.sendMessage();
        });
        try {
            // 5. Confirm dialog opens with title "Test Title"
            await expect(interactiveDialog.container).toBeVisible({timeout: 45000});
            break; // dialog appeared — proceed
        } catch (err) {
            if (attempt === 3) {
                throw err; // exhausted retries — let the error surface naturally
            }
            await setupDemoPlugin(adminClient, pw);
            await channelsPage.page.waitForTimeout(2000);
            // attempt timed out — retry the slash command
        }
    }
    await expect(interactiveDialog.container.getByRole('heading', {level: 1})).toContainText('Test Title');

    // 6. Fill required fields
    // Display Name already has default "default text" — overwrite
    await interactiveDialog.getFieldByTestId('realnameinput').fill('Test Input');

    // Email and Password are required
    await interactiveDialog.getFieldByTestId('someemailemail').fill('test@example.com');
    await interactiveDialog.getFieldByTestId('somepasswordpassword').fill('testpassword123');

    // Number is required
    await interactiveDialog.getFieldByTestId('somenumbernumber').fill('42');

    // Option Selector — required, no default
    await interactiveDialog.getSelectControl('someoptionselector').click();
    await interactiveDialog.selectOption('Option1');

    // Required checkboxes
    await interactiveDialog.container.getByRole('checkbox', {name: 'Agree to the terms of service'}).check();
    await interactiveDialog.container.getByRole('checkbox', {name: 'Agree to the annoying terms of service'}).check();

    // Radio Option Selector — required
    await interactiveDialog.container.getByRole('radio', {name: 'Option1'}).click();

    // 7. Submit the dialog
    await interactiveDialog.container.getByRole('button', {name: 'Submit'}).click();
    await expect(interactiveDialog.container).not.toBeVisible();

    // 8. Verify the submit post appears in the channel
    // Note: "Interative" is a typo in the demo plugin — not a test error
    await expect(channelsPage.centerView.getSystemMessage('submitted an Interative Dialog')).toBeVisible();
});

test('should post cancellation notification when /dialog is cancelled', async ({pw}) => {
    test.setTimeout(120000);

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

    // 4. Send /dialog command (with one retry if the dialog doesn't appear).
    // Re-apply guard: concurrent initSetup() resets PluginSettings.
    await setupDemoPlugin(adminClient, pw);
    await channelsPage.page.waitForTimeout(6000);
    const interactiveDialog = channelsPage.interactiveDialog;
    for (let attempt = 0; attempt < 4; attempt++) {
        await sendDemoSlashCommand(channelsPage.page, async () => {
            await channelsPage.centerView.postCreate.input.fill('/dialog');
            await channelsPage.centerView.postCreate.sendMessage();
        });
        try {
            // 5. Confirm dialog opens
            await expect(interactiveDialog.container).toBeVisible({timeout: 45000});
            break;
        } catch (err) {
            if (attempt === 3) {
                throw err;
            }
            await setupDemoPlugin(adminClient, pw);
            await channelsPage.page.waitForTimeout(2000);
        }
    }
    await expect(interactiveDialog.container.getByRole('heading', {level: 1})).toContainText('Test Title');
    await expect(interactiveDialog.container.getByRole('button', {name: 'Cancel'})).toBeVisible();
    await expect(interactiveDialog.container.getByRole('button', {name: 'Submit'})).toBeVisible();

    // 6. Cancel the dialog
    await interactiveDialog.container.getByRole('button', {name: 'Cancel'}).click();
    await expect(interactiveDialog.container).not.toBeVisible();

    // 7. Verify the cancellation post appears in the channel
    // Note: "Interative" is a typo in the demo plugin — not a test error
    await expect(channelsPage.centerView.getSystemMessage('canceled an Interative Dialog')).toBeVisible();
});

test('should show validation errors when required fields are submitted empty', async ({pw}) => {
    test.setTimeout(120000);

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

    // 4. Send /dialog command (with one retry if the dialog doesn't appear).
    // Re-apply guard: concurrent initSetup() resets PluginSettings.
    await setupDemoPlugin(adminClient, pw);
    await channelsPage.page.waitForTimeout(6000);
    const interactiveDialog = channelsPage.interactiveDialog;
    for (let attempt = 0; attempt < 4; attempt++) {
        await sendDemoSlashCommand(channelsPage.page, async () => {
            await channelsPage.centerView.postCreate.input.fill('/dialog');
            await channelsPage.centerView.postCreate.sendMessage();
        });
        try {
            // 5. Confirm dialog opens
            await expect(interactiveDialog.container).toBeVisible({timeout: 45000});
            break;
        } catch (err) {
            if (attempt === 3) {
                throw err;
            }
            await setupDemoPlugin(adminClient, pw);
            await channelsPage.page.waitForTimeout(2000);
        }
    }
    await expect(interactiveDialog.container.getByRole('heading', {level: 1})).toContainText('Test Title');

    // 6. Clear the Number field and submit
    await interactiveDialog.getFieldByTestId('somenumbernumber').clear();
    await interactiveDialog.container.getByRole('button', {name: 'Submit'}).click();

    // 7. Verify dialog stays open with validation errors
    await expect(interactiveDialog.container).toBeVisible();
    await expect(interactiveDialog.container.getByText('Please fix all field errors', {exact: true})).toBeVisible();
    await expect(
        interactiveDialog.getFieldByTestId('somenumber').getByText('This field is required.', {exact: true}),
    ).toBeVisible();
});

test('should show general error and keep dialog open on /dialog error submit', async ({pw}) => {
    test.setTimeout(120000);

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

    // 4. Send /dialog error command (with one retry if the dialog doesn't appear).
    // Re-apply guard: concurrent initSetup() resets PluginSettings.
    await setupDemoPlugin(adminClient, pw);
    await channelsPage.page.waitForTimeout(6000);
    const interactiveDialog = channelsPage.interactiveDialog;
    for (let attempt = 0; attempt < 4; attempt++) {
        await sendDemoSlashCommand(channelsPage.page, async () => {
            await channelsPage.centerView.postCreate.input.fill('/dialog error');
            await channelsPage.centerView.postCreate.sendMessage();
        });
        try {
            // 5. Confirm dialog opens with title "Simple Dialog Test"
            await expect(interactiveDialog.container).toBeVisible({timeout: 45000});
            break;
        } catch (err) {
            if (attempt === 3) {
                throw err;
            }
            await setupDemoPlugin(adminClient, pw);
            await channelsPage.page.waitForTimeout(2000);
        }
    }
    await expect(interactiveDialog.container.getByRole('heading', {level: 1})).toContainText('Simple Dialog Test');
    await expect(interactiveDialog.container.getByRole('button', {name: 'Cancel'})).toBeVisible();
    await expect(interactiveDialog.container.getByRole('button', {name: 'Submit Test'})).toBeVisible();

    // 6. Fill the optional field and submit
    await interactiveDialog.container.getByPlaceholder('Enter some text (optional)...').fill('sample test input');
    await interactiveDialog.container.getByRole('button', {name: 'Submit Test'}).click();

    // 7. Verify general error appears and dialog stays open
    await expect(interactiveDialog.container.getByText('some error', {exact: true})).toBeVisible();
    await expect(interactiveDialog.container).toBeVisible();
    await expect(interactiveDialog.container.getByPlaceholder('Enter some text (optional)...')).toHaveValue(
        'sample test input',
    );
});

test('should show general error on /dialog error-no-elements confirm', async ({pw}) => {
    test.setTimeout(120000);

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

    // 4. Send /dialog error-no-elements command (with one retry if the dialog doesn't appear).
    // Re-apply guard: concurrent initSetup() resets PluginSettings.
    await setupDemoPlugin(adminClient, pw);
    await channelsPage.page.waitForTimeout(6000);
    const interactiveDialog = channelsPage.interactiveDialog;
    for (let attempt = 0; attempt < 4; attempt++) {
        await sendDemoSlashCommand(channelsPage.page, async () => {
            await channelsPage.centerView.postCreate.input.fill('/dialog error-no-elements');
            await channelsPage.centerView.postCreate.sendMessage();
        });
        try {
            // 5. Confirm dialog opens with title "Sample Confirmation Dialog" and no form fields
            await expect(interactiveDialog.container).toBeVisible({timeout: 45000});
            break;
        } catch (err) {
            if (attempt === 3) {
                throw err;
            }
            await setupDemoPlugin(adminClient, pw);
            await channelsPage.page.waitForTimeout(2000);
        }
    }
    await expect(interactiveDialog.container.getByRole('heading', {level: 1})).toContainText(
        'Sample Confirmation Dialog',
    );
    await expect(interactiveDialog.container.getByRole('button', {name: 'Cancel'})).toBeVisible();
    await expect(interactiveDialog.container.getByRole('button', {name: 'Confirm'})).toBeVisible();
    await expect(interactiveDialog.container.getByRole('textbox')).not.toBeVisible();

    // 6. Click Confirm
    await interactiveDialog.container.getByRole('button', {name: 'Confirm'}).click();

    // 7. Verify general error appears and dialog stays open
    await expect(interactiveDialog.container.getByText('some error', {exact: true})).toBeVisible();
    await expect(interactiveDialog.container).toBeVisible();
    await expect(interactiveDialog.container.getByRole('button', {name: 'Cancel'})).toBeVisible();
    await expect(interactiveDialog.container.getByRole('button', {name: 'Confirm'})).toBeVisible();
});
