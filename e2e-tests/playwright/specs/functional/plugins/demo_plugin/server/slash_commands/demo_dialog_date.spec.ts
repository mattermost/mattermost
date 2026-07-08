// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {setupDemoPlugin} from '../../helpers';

test('should open /dialog date and post submit confirmation after selecting dates', async ({pw}) => {
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

    // 3. Navigate to Town Square
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // 4. Send /dialog date command (retry if the dialog doesn't appear — plugin races are common under PW_WORKERS=8).
    const interactiveDialog = channelsPage.interactiveDialog;
    for (let attempt = 0; attempt < 3; attempt++) {
        await channelsPage.centerView.postCreate.input.fill('/dialog date');
        await channelsPage.centerView.postCreate.sendMessage();
        try {
            await expect(interactiveDialog.container).toBeVisible({timeout: 45000});
            break;
        } catch (err) {
            if (attempt === 2) {
                throw err;
            }
            try {
                await adminClient.enablePlugin('com.mattermost.demo-plugin');
            } catch {
                // Already enabled or transient error — ignore.
            }
            await expect
                .poll(() => pw.isPluginActive(adminClient, 'com.mattermost.demo-plugin'), {
                    timeout: 45_000,
                    intervals: [2000],
                })
                .toBe(true);
            await new Promise((resolve) => setTimeout(resolve, 6000));
        }
    }
    await expect(interactiveDialog.container.getByRole('heading', {level: 1})).toContainText(
        'Date & DateTime Test Dialog',
    );

    // 6. Verify field labels and Event Title default value
    await expect(interactiveDialog.container.getByText('Meeting Date *', {exact: true})).toBeVisible();
    await expect(interactiveDialog.container.getByText('Meeting Date & Time *', {exact: true})).toBeVisible();
    await expect(interactiveDialog.container.getByText('Event Title *', {exact: true})).toBeVisible();
    await expect(interactiveDialog.container.getByRole('textbox', {name: 'Event Title *'})).toHaveValue('Team Meeting');

    // 7. Select a date using the Meeting Date picker
    await interactiveDialog.container.getByRole('button', {name: /Select a meeting date/i}).click();
    // Click day 20 — reliably available in any month
    await interactiveDialog.selectDate('20');

    // 8. Select date and time using the Meeting Date & Time picker.
    // The datetime field renders via DateTimeInput which wraps its date part in
    // <div class="dateTime__date"> — a class unique to DateTimeInput and absent
    // from the date-only "Meeting Date" field (AppsFormDateField → DatePicker directly).
    // Scoping by that wrapper is more reliable than accessible-name matching on the
    // role="button" div, whose name includes a CSS icon-font glyph that browsers
    // include in accname but which is invisible to textContent inspection.
    await interactiveDialog.datePickerButton.click();
    await interactiveDialog.selectDate('22');

    // Select a time from the time picker.  The time button carries aria-label="Time"
    // (set explicitly in DateTimeInput), so the name-based locator is reliable here.
    await interactiveDialog.container
        .getByRole('button', {name: /Time|Select a time/i})
        .first()
        .click();
    await interactiveDialog.selectTime('3:00 PM');

    // 9. Submit — button is labelled "Create Event"
    await interactiveDialog.container.getByRole('button', {name: 'Create Event'}).click();
    await expect(interactiveDialog.container).not.toBeVisible();

    // 10. Verify submit post appears in the channel
    await expect(channelsPage.centerView.getSystemMessage('submitted a Date Dialog')).toBeVisible();
});
