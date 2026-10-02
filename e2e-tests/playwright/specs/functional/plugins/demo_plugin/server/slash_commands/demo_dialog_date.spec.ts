// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {duration, expect, test} from '@mattermost/playwright-lib';

test('should open /dialog date and post submit confirmation after selecting dates', async ({pw}) => {
    // A concurrent plugin_crash.spec.ts worker can leave the submit hook broken for up to
    // ~50s while it crashes and fully recovers the shared demo plugin (see that spec for the
    // recovery budget the retry below is sized against). test.slow() triples the test
    // timeout so the retry has room to outlast that window.
    test.slow();

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

    // # Send /dialog date command (retry once on a UI timing miss)
    const dialog = channelsPage.page.getByRole('dialog');
    for (let attempt = 0; attempt < 3; attempt++) {
        await channelsPage.centerView.postCreate.input.fill('/dialog date');
        await channelsPage.centerView.postCreate.sendMessage();
        try {
            await expect(dialog).toBeVisible({timeout: duration.ten_sec});
            break;
        } catch (err) {
            if (attempt === 2) {
                throw err;
            }
        }
    }

    // * Verify dialog opens with title "Date & DateTime Test Dialog"
    await expect(dialog.getByRole('heading', {level: 1})).toContainText('Date & DateTime Test Dialog');

    // * Verify field labels and Event Title default value
    await expect(dialog.getByText('Meeting Date *', {exact: true})).toBeVisible();
    await expect(dialog.getByText('Meeting Date & Time *', {exact: true})).toBeVisible();
    await expect(dialog.getByText('Event Title *', {exact: true})).toBeVisible();
    await expect(dialog.getByRole('textbox', {name: 'Event Title *'})).toHaveValue('Team Meeting');

    // # Select a date using the Meeting Date picker
    await dialog.getByRole('button', {name: /Select a meeting date/i}).click();
    await expect(channelsPage.page.getByRole('grid')).toBeVisible();
    // Click day 20 — reliably available in any month
    await channelsPage.page.getByRole('grid').getByText('20', {exact: true}).click();

    // # Select a date and time using the Meeting Date & Time picker.
    // The datetime field renders via DateTimeInput which wraps its date part in
    // <div class="dateTime__date"> — a class unique to DateTimeInput and absent
    // from the date-only "Meeting Date" field (AppsFormDateField → DatePicker directly).
    // Scoping by that wrapper is more reliable than accessible-name matching on the
    // role="button" div, whose name includes a CSS icon-font glyph that browsers
    // include in accname but which is invisible to textContent inspection.
    await dialog.locator('.dateTime__date').getByRole('button').click();
    await expect(channelsPage.page.getByRole('grid')).toBeVisible();
    await channelsPage.page.getByRole('grid').getByText('22', {exact: true}).click();

    // Select a time from the time picker.  The time button carries aria-label="Time"
    // (set explicitly in DateTimeInput), so the name-based locator is reliable here.
    await dialog
        .getByRole('button', {name: /Time|Select a time/i})
        .first()
        .click();
    await channelsPage.page.getByRole('menuitem', {name: '3:00 PM'}).click();

    // # Submit — button is labelled "Create Event" (with retries if the plugin is
    // transiently unavailable, e.g. during a concurrent plugin_crash.spec.ts recovery
    // cycle, in which case the submit request can fail silently and the dialog never
    // closes — re-clicking is safe since the filled-in fields are retained). 8 attempts
    // gives ~80s of total budget, comfortably outlasting plugin_crash.spec.ts's worst-case
    // ~50s recovery cycle.
    for (let attempt = 0; attempt < 8; attempt++) {
        await dialog.getByRole('button', {name: 'Create Event'}).click();
        try {
            await expect(dialog).not.toBeVisible({timeout: duration.ten_sec});
            break;
        } catch (err) {
            if (attempt === 7) {
                throw err;
            }
        }
    }

    // * Verify the dialog closes and submit post appears in the channel
    await expect(dialog).not.toBeVisible();
    await expect(
        channelsPage.centerView.container.locator('p').filter({hasText: 'submitted a Date Dialog'}),
    ).toBeVisible();
});
