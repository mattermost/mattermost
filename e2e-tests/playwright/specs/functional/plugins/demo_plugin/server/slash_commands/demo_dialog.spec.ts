// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {duration, expect, test} from '@mattermost/playwright-lib';

import {logDemoPluginDiagnostics, recoverDemoPlugin, sendDemoSlashCommand} from '../../helpers';

// DEBUG-ONLY (temporary): logs every response to the dialog submit API so CI output shows
// whether the request ever got a response at all, and with what status/timing, instead of
// only seeing the client-side symptom (dialog stays visible). See recoverDemoPlugin's doc
// comment for background. Purely observational — does not alter control flow.
function attachDialogSubmitResponseLogger(page: {on: (event: 'response', handler: (response: unknown) => void) => void}) {
    page.on('response', (response: any) => {
        if (typeof response?.url === 'function' && response.url().includes('/api/v4/actions/dialogs/submit')) {
            // eslint-disable-next-line no-console
            console.log(`[demo-plugin-diag] dialog submit response: status=${response.status()} url=${response.url()}`);
        }
    });
}

test('should open /dialog and post submit confirmation on submit', async ({pw}) => {
    // The submit hook has been observed to stop responding for the rest of a CI worker's
    // run with no single confirmed trigger (reproduced without plugin_crash.spec.ts ever
    // running first in the same worker — see recoverDemoPlugin's doc comment). The retry
    // loop below forces a full plugin recovery cycle partway through, which is the one
    // action known to clear it, so give it a generous timeout to leave room for that cycle.
    test.setTimeout(duration.four_min);

    // # Setup
    const {adminClient, user, team} = await pw.initSetup();
    await pw.ensureDemoPlugin();

    // # Login
    const {channelsPage} = await pw.testBrowser.login(user);
    attachDialogSubmitResponseLogger(channelsPage.page); // DEBUG-ONLY (temporary)
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

    // # Submit the dialog (with retries if the plugin is transiently unavailable, in which
    // case the submit request can fail silently and the dialog never closes — re-clicking
    // Submit is safe since the filled-in fields are retained). If plain retries don't clear
    // it, force a full plugin recovery cycle once and keep retrying — see
    // recoverDemoPlugin's doc comment for why that is the one action known to help.
    await logDemoPluginDiagnostics(adminClient, 'submit-loop:attempt=0'); // DEBUG-ONLY (temporary)
    for (let attempt = 0; attempt < 12; attempt++) {
        if (attempt === 6) {
            await recoverDemoPlugin(adminClient);
        }
        await dialog.getByRole('button', {name: 'Submit'}).click();
        try {
            await expect(dialog).not.toBeVisible({timeout: duration.ten_sec});
            break;
        } catch (err) {
            // eslint-disable-next-line no-console
            console.log(`[demo-plugin-diag] submit-loop:attempt=${attempt} failed to close dialog`); // DEBUG-ONLY (temporary)
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
    // See the submit test above for why this needs extra time.
    test.setTimeout(duration.four_min);

    // # Setup
    const {adminClient, user, team} = await pw.initSetup();
    await pw.ensureDemoPlugin();

    // # Login
    const {channelsPage} = await pw.testBrowser.login(user);
    attachDialogSubmitResponseLogger(channelsPage.page); // DEBUG-ONLY (temporary)
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
    // plugin is transiently unavailable: the client-side dialog close can succeed while
    // the server-side cancel notification silently fails, so reopen and cancel again on
    // failure). If plain retries don't clear it, force a full plugin recovery cycle once —
    // see recoverDemoPlugin's doc comment for why that is the one action known to help.
    const cancellationPost = channelsPage.centerView.container
        .locator('p')
        .filter({hasText: 'canceled an Interative Dialog'});
    await logDemoPluginDiagnostics(adminClient, 'cancel-loop:attempt=0'); // DEBUG-ONLY (temporary)
    for (let attempt = 0; attempt < 12; attempt++) {
        if (attempt === 6) {
            await recoverDemoPlugin(adminClient);
            await sendDemoSlashCommand(channelsPage.page, async () => {
                await channelsPage.centerView.postCreate.input.fill('/dialog');
                await channelsPage.centerView.postCreate.sendMessage();
            });
            await expect(dialog).toBeVisible({timeout: duration.ten_sec});
        }
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
