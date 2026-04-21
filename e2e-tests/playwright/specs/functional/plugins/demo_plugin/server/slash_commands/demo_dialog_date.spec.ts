// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {setupDemoPlugin} from '../../helpers';

test('should open /dialog date and post submit confirmation after selecting dates', async ({pw}) => {
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

    // 4. Send /dialog date command
    await channelsPage.centerView.postCreate.input.fill('/dialog date');
    await channelsPage.centerView.postCreate.sendMessage();

    // 5. Confirm dialog opens with correct title
    const dialog = channelsPage.page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', {level: 1})).toContainText('Date & DateTime Test Dialog');

    // 6. Verify field labels and Event Title default value
    await expect(dialog.getByText('Meeting Date *', {exact: true})).toBeVisible();
    await expect(dialog.getByText('Meeting Date & Time *', {exact: true})).toBeVisible();
    await expect(dialog.getByText('Event Title *', {exact: true})).toBeVisible();
    await expect(dialog.getByRole('textbox', {name: 'Event Title *'})).toHaveValue('Team Meeting');

    // 7. Select a date using the Meeting Date picker
    await dialog.getByRole('button', {name: /Select a meeting date/i}).click();
    await expect(channelsPage.page.getByRole('grid')).toBeVisible();
    // Click day 20 — reliably available in any month
    await channelsPage.page.getByRole('grid').getByText('20', {exact: true}).click();

    // 8. Select date and time using the Meeting Date & Time picker
    await dialog
        .getByRole('button', {name: /Date.*Today|Select a date/i})
        .first()
        .click();
    await expect(channelsPage.page.getByRole('grid')).toBeVisible();
    await channelsPage.page.getByRole('grid').getByText('22', {exact: true}).click();

    // Select a time from the time picker
    await dialog
        .getByRole('button', {name: /Time|Select a time/i})
        .first()
        .click();
    await channelsPage.page.getByRole('menuitem', {name: '3:00 PM'}).click();

    // 9. Submit — button is labelled "Create Event"
    await dialog.getByRole('button', {name: 'Create Event'}).click();
    await expect(dialog).not.toBeVisible();

    // 10. Verify submit post appears in the channel
    await expect(
        channelsPage.centerView.container.locator('p').filter({hasText: 'submitted a Date Dialog'}),
    ).toBeVisible();
});
