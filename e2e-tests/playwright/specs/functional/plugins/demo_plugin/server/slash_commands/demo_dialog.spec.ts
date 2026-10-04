// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {duration, expect, test} from '@mattermost/playwright-lib';

import {sendDemoSlashCommand} from '../../helpers';

test('should open /dialog and post submit confirmation on submit', async ({pw}) => {
    // A concurrent plugin_crash.spec.ts worker can leave the submit hook broken for up to
    // ~50s while it crashes and fully recovers the shared demo plugin (see that spec for the
    // recovery budget this is sized against). If plugin_crash.spec.ts itself needs a CI
    // retry (Playwright retries: 1), that window can compound to ~100s+ across both runs.
    // An explicit timeout (rather than test.slow()'s 3x default) gives the retry loop below
    // enough headroom to outlast that compounded worst case.
    test.setTimeout(duration.four_min);

    // # Setup
    const {user, team} = await pw.initSetup();
    await pw.ensureDemoPlugin();

    // # Login
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Navigate to Demo Plugin channel
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Send /dialog command (with one retry if the dialog doesn't appear)
    const dialog = channelsPage.page.getByRole('dialog');
    for (let attempt = 0; attempt < 4; attempt++) {
        await sendDemoSlashCommand(channelsPage.page, async () => {
            await channelsPage.centerView.postCreate.input.fill('/dialog');
            await channelsPage.centerView.postCreate.sendMessage();
        });
        try {
            await expect(dialog).toBeVisible({timeout: duration.ten_sec});
            break; // dialog appeared — proceed
        } catch (err) {
            if (attempt === 3) {
                throw err; // exhausted retries — let the error surface naturally
            }
            // attempt timed out — retry the slash command
        }
    }

    // * Verify dialog opens with title "Test Title"
    await expect(dialog.getByRole('heading', {level: 1})).toContainText('Test Title');

    // # Fill required fields
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

    // # Submit the dialog (with retries if the plugin is transiently unavailable, e.g.
    // during a concurrent plugin_crash.spec.ts recovery cycle, in which case the submit
    // request can fail silently and the dialog never closes — re-clicking Submit is safe
    // since the filled-in fields are retained). 12 attempts gives ~120s of total budget,
    // outlasting even a compounded recovery cycle (plugin_crash.spec.ts retried by CI).
    for (let attempt = 0; attempt < 12; attempt++) {
        await dialog.getByRole('button', {name: 'Submit'}).click();
        try {
            await expect(dialog).not.toBeVisible({timeout: duration.ten_sec});
            break;
        } catch (err) {
            if (attempt === 11) {
                throw err;
            }
        }
    }

    // * Verify the dialog closed and the submit post appears in the channel
    // Note: "Interative" is a typo in the demo plugin — not a test error
    await expect(dialog).not.toBeVisible();
    await expect(
        channelsPage.centerView.container.locator('p').filter({hasText: 'submitted an Interative Dialog'}),
    ).toBeVisible();
});

test('should post cancellation notification when /dialog is cancelled', async ({pw}) => {
    // See the submit test above for why this needs extra time: a concurrent
    // plugin_crash.spec.ts worker can leave the cancel hook broken for up to ~50s,
    // compounding to ~100s+ if plugin_crash.spec.ts itself needs a CI retry.
    test.setTimeout(duration.four_min);

    // # Setup
    const {user, team} = await pw.initSetup();
    await pw.ensureDemoPlugin();

    // # Login
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Navigate to Demo Plugin channel
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Send /dialog command (with one retry if the dialog doesn't appear)
    const dialog = channelsPage.page.getByRole('dialog');
    for (let attempt = 0; attempt < 4; attempt++) {
        await sendDemoSlashCommand(channelsPage.page, async () => {
            await channelsPage.centerView.postCreate.input.fill('/dialog');
            await channelsPage.centerView.postCreate.sendMessage();
        });
        try {
            await expect(dialog).toBeVisible({timeout: duration.ten_sec});
            break;
        } catch (err) {
            if (attempt === 3) {
                throw err;
            }
        }
    }

    // * Verify dialog opens
    await expect(dialog.getByRole('heading', {level: 1})).toContainText('Test Title');
    await expect(dialog.getByRole('button', {name: 'Cancel'})).toBeVisible();
    await expect(dialog.getByRole('button', {name: 'Submit'})).toBeVisible();

    // # Cancel the dialog and verify the cancellation post appears (with retries if the
    // plugin is transiently unavailable, e.g. during a concurrent plugin_crash.spec.ts
    // recovery cycle: the client-side dialog close can succeed while the server-side
    // cancel notification silently fails, so reopen and cancel again on failure)
    const cancellationPost = channelsPage.centerView.container
        .locator('p')
        .filter({hasText: 'canceled an Interative Dialog'});
    for (let attempt = 0; attempt < 12; attempt++) {
        if (await dialog.isVisible()) {
            await dialog.getByRole('button', {name: 'Cancel'}).click();
        }
        try {
            await expect(dialog).not.toBeVisible({timeout: duration.ten_sec});
            // * Verify the cancellation post appears in the channel
            // Note: "Interative" is a typo in the demo plugin — not a test error
            await expect(cancellationPost).toBeVisible({timeout: duration.ten_sec});
            break;
        } catch (err) {
            if (attempt === 11) {
                throw err;
            }
            // Reopen the dialog for the next attempt
            await sendDemoSlashCommand(channelsPage.page, async () => {
                await channelsPage.centerView.postCreate.input.fill('/dialog');
                await channelsPage.centerView.postCreate.sendMessage();
            });
            await expect(dialog).toBeVisible({timeout: duration.ten_sec});
        }
    }
});

test('should show validation errors when required fields are submitted empty', async ({pw}) => {
    // # Setup
    const {user, team} = await pw.initSetup();
    await pw.ensureDemoPlugin();

    // # Login
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Navigate to Demo Plugin channel
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Send /dialog command (with one retry if the dialog doesn't appear)
    const dialog = channelsPage.page.getByRole('dialog');
    for (let attempt = 0; attempt < 4; attempt++) {
        await sendDemoSlashCommand(channelsPage.page, async () => {
            await channelsPage.centerView.postCreate.input.fill('/dialog');
            await channelsPage.centerView.postCreate.sendMessage();
        });
        try {
            await expect(dialog).toBeVisible({timeout: duration.ten_sec});
            break;
        } catch (err) {
            if (attempt === 3) {
                throw err;
            }
        }
    }

    // * Verify dialog opens
    await expect(dialog.getByRole('heading', {level: 1})).toContainText('Test Title');

    // # Clear the Number field and submit
    await dialog.getByTestId('somenumbernumber').clear();
    await dialog.getByRole('button', {name: 'Submit'}).click();

    // * Verify dialog stays open with validation errors
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Please fix all field errors', {exact: true})).toBeVisible();
    await expect(dialog.getByTestId('somenumber').getByText('This field is required.', {exact: true})).toBeVisible();
});

test('should show general error and keep dialog open on /dialog error submit', async ({pw}) => {
    // # Setup
    const {user, team} = await pw.initSetup();
    await pw.ensureDemoPlugin();

    // # Login
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Navigate to Town Square
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Send /dialog error command (with one retry if the dialog doesn't appear)
    const dialog = channelsPage.page.getByRole('dialog');
    for (let attempt = 0; attempt < 4; attempt++) {
        await sendDemoSlashCommand(channelsPage.page, async () => {
            await channelsPage.centerView.postCreate.input.fill('/dialog error');
            await channelsPage.centerView.postCreate.sendMessage();
        });
        try {
            await expect(dialog).toBeVisible({timeout: duration.ten_sec});
            break;
        } catch (err) {
            if (attempt === 3) {
                throw err;
            }
        }
    }

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
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Navigate to Town Square
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Send /dialog error-no-elements command (with one retry if the dialog doesn't appear)
    const dialog = channelsPage.page.getByRole('dialog');
    for (let attempt = 0; attempt < 4; attempt++) {
        await sendDemoSlashCommand(channelsPage.page, async () => {
            await channelsPage.centerView.postCreate.input.fill('/dialog error-no-elements');
            await channelsPage.centerView.postCreate.sendMessage();
        });
        try {
            await expect(dialog).toBeVisible({timeout: duration.ten_sec});
            break;
        } catch (err) {
            if (attempt === 3) {
                throw err;
            }
        }
    }

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
