// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {sendDemoSlashCommand} from '../../helpers';

test('should open /dialog date and post submit confirmation after selecting dates', async ({pw}) => {
    // # Setup
    const {user, team} = await pw.initSetup();
    await pw.ensureDemoPlugin();

    // # Login
    const {app} = await pw.testBrowser.login(user);

    // # Navigate to Town Square
    await app.channelsPage.goto({team, channel: {name: 'town-square'}});
    await expect(app.center.postCreate.message.container).toBeVisible();

    // # Send /dialog date command
    const dialog = app.page.getByRole('dialog');
    await sendDemoSlashCommand(app, '/dialog date');
    await expect(dialog).toBeVisible();

    // * Verify dialog opens with title "Date & DateTime Test Dialog"
    await expect(dialog.getByRole('heading', {level: 1})).toContainText('Date & DateTime Test Dialog');

    // * Verify field labels and Event Title default value
    await expect(dialog.getByText('Meeting Date *', {exact: true})).toBeVisible();
    await expect(dialog.getByText('Meeting Date & Time *', {exact: true})).toBeVisible();
    await expect(dialog.getByText('Event Title *', {exact: true})).toBeVisible();
    await expect(dialog.getByRole('textbox', {name: 'Event Title *'})).toHaveValue('Team Meeting');

    // # Select a date using the Meeting Date picker
    await dialog.getByRole('button', {name: /Select a meeting date/i}).click();
    await expect(app.page.getByRole('grid')).toBeVisible();
    // Click day 20 — reliably available in any month
    await app.page.getByRole('grid').getByText('20', {exact: true}).click();
    await expect(app.page.getByRole('grid')).not.toBeVisible();

    // # Select a date and time using the Meeting Date & Time picker.
    // The datetime field renders via DateTimeInput which wraps its date part in
    // <div class="dateTime__date"> — a class unique to DateTimeInput and absent
    // from the date-only "Meeting Date" field (AppsFormDateField → DatePicker directly).
    // Scoping by that wrapper is more reliable than accessible-name matching on the
    // role="button" div, whose name includes a CSS icon-font glyph that browsers
    // include in accname but which is invisible to textContent inspection.
    await dialog.locator('.dateTime__date').getByRole('button').click();
    await expect(app.page.getByRole('grid')).toBeVisible();
    await app.page.getByRole('grid').getByText('22', {exact: true}).click();
    await expect(app.page.getByRole('grid')).not.toBeVisible();

    // Select a time from the time picker.  The time button carries aria-label="Time"
    // (set explicitly in DateTimeInput), so the name-based locator is reliable here.
    await dialog
        .getByRole('button', {name: /Time|Select a time/i})
        .first()
        .click();
    await expect(app.page.getByRole('menuitem', {name: '3:00 PM'})).toBeVisible();
    await app.page.getByRole('menuitem', {name: '3:00 PM'}).click();
    await expect(app.page.getByRole('menuitem', {name: '3:00 PM'})).not.toBeVisible();

    // # Submit — button is labelled "Create Event"
    await dialog.getByRole('button', {name: 'Create Event'}).click();

    // * Verify the dialog closes and submit post appears in the channel
    await expect(dialog).not.toBeVisible();
    await expect(await app.center.postList.postList.itemWith({text: 'submitted a Date Dialog'})).toBeVisible();
});
