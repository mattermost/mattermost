// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Date / datetime fields in native block_dialog (datetime_config).
 */

import {expect, isWebhookTestServerReachable, test, testConfig} from '@mattermost/playwright-lib';

import {
    dialogTags,
    expectEphemeral,
    getSelectableDay,
    openBlocksDialogFromPost,
    openDatePicker,
    selectDayFromPicker,
    setupDialogOpenPost,
} from './mm_blocks_dialog_helpers';

test.describe('Interactive mm_blocks (blocks dialog datetime)', () => {
    test.beforeEach(async ({request}) => {
        test.skip(
            !(await isWebhookTestServerReachable(request)),
            [
                `Webhook test server is not reachable at ${testConfig.webhookBaseUrl}.`,
                'Start it from the repo: cd e2e-tests/cypress && npm run start:webhook',
            ].join('\n'),
        );
    });

    test('date and datetime fields open pickers and submit', {tag: [...dialogTags]}, async ({pw, request}) => {
        const {channelsPage, marker, openButtonName} = await setupDialogOpenPost(pw, request, {
            scenario: 'datetime_basic',
            buttonText: 'Open datetime basic',
            titleHint: 'mm_blocks datetime basic',
        });

        const dialog = await openBlocksDialogFromPost(channelsPage, marker, openButtonName);
        await expect(dialog.locator('.mm-blocks-date-input').filter({hasText: 'Event Date'})).toBeVisible();
        await expect(dialog.locator('.mm-blocks-datetime-input').filter({hasText: 'Meeting Time'})).toBeVisible();

        const target = getSelectableDay(5);
        await openDatePicker(dialog, channelsPage.page, 'Event Date');
        await selectDayFromPicker(channelsPage.page, target.day, target.needsNextMonth);

        await dialog.getByRole('button', {name: 'Submit'}).click();
        await expect(dialog).toBeHidden();
        await expectEphemeral(channelsPage.page, /event_date=\d{4}-\d{2}-\d{2}/);
    });

    test('min_date today disables past days', {tag: [...dialogTags]}, async ({pw, request}) => {
        const {channelsPage, marker, openButtonName} = await setupDialogOpenPost(pw, request, {
            scenario: 'datetime_mindate',
            buttonText: 'Open datetime mindate',
            titleHint: 'mm_blocks datetime mindate',
        });

        const dialog = await openBlocksDialogFromPost(channelsPage, marker, openButtonName);
        await openDatePicker(dialog, channelsPage.page, 'Future Date Only');

        const calendar = channelsPage.page.locator('.rdp').first();
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        const now = new Date();
        if (twoDaysAgo.getMonth() !== now.getMonth()) {
            await calendar.locator('.rdp-nav_button_previous, button[name="previous-month"]').first().click();
        }
        const pastDay = calendar
            .locator('.rdp-day:not(.rdp-day_outside) .rdp-day_button')
            .filter({hasText: new RegExp(`^${twoDaysAgo.getDate()}$`)})
            .first();
        await expect(pastDay).toBeVisible();
        const disabled =
            (await pastDay.getAttribute('aria-disabled')) === 'true' ||
            (await pastDay.getAttribute('disabled')) !== null ||
            ((await pastDay.getAttribute('class')) || '').includes('disabled');
        expect(disabled).toBeTruthy();
    });

    test('custom time_interval shows 30-minute options', {tag: [...dialogTags]}, async ({pw, request}) => {
        const {channelsPage, marker, openButtonName} = await setupDialogOpenPost(pw, request, {
            scenario: 'datetime_interval',
            buttonText: 'Open datetime interval',
            titleHint: 'mm_blocks datetime interval',
        });

        const dialog = await openBlocksDialogFromPost(channelsPage, marker, openButtonName);
        const field = dialog.locator('.mm-blocks-datetime-input').filter({hasText: 'Custom Interval Time'});
        await field.locator('.dateTime__date .date-time-input').click();
        await expect(channelsPage.page.locator('.rdp').first()).toBeVisible();
        const target = getSelectableDay(3);
        await selectDayFromPicker(channelsPage.page, target.day, target.needsNextMonth);

        await field.locator('button[data-testid="time_button"]').click();
        await expect(channelsPage.page.locator('[id$="expiryTimeMenu"]')).toBeVisible();
        const options = channelsPage.page.locator('[id^="time_option_"]');
        await expect(options.first()).toBeVisible();
        const count = await options.count();
        expect(count).toBeGreaterThan(24); // 30-min intervals → more than 24 hourly slots
    });

    test('relative initial_value populates date and datetime fields', {tag: [...dialogTags]}, async ({pw, request}) => {
        const {channelsPage, marker, openButtonName} = await setupDialogOpenPost(pw, request, {
            scenario: 'datetime_relative',
            buttonText: 'Open datetime relative',
            titleHint: 'mm_blocks datetime relative',
        });

        const dialog = await openBlocksDialogFromPost(channelsPage, marker, openButtonName);
        const dateField = dialog.locator('.mm-blocks-date-input').filter({hasText: 'Relative Date Example'});
        await expect(dateField.locator('.date-time-input__value')).not.toBeEmpty();

        const dtField = dialog.locator('.mm-blocks-datetime-input').filter({hasText: 'Relative DateTime Example'});
        await expect(dtField.getByRole('button', {name: /Tomorrow/i})).toBeVisible();
        await expect(dtField.locator('time')).not.toBeEmpty();
    });

    test('date locale formatting shows Month Day, Year', {tag: [...dialogTags]}, async ({pw, request}) => {
        const {channelsPage, marker, openButtonName} = await setupDialogOpenPost(pw, request, {
            scenario: 'datetime_basic',
            buttonText: 'Open datetime locale',
            titleHint: 'mm_blocks datetime locale',
        });

        const dialog = await openBlocksDialogFromPost(channelsPage, marker, openButtonName);
        const target = getSelectableDay(5);
        await openDatePicker(dialog, channelsPage.page, 'Event Date');
        await selectDayFromPicker(channelsPage.page, target.day, target.needsNextMonth);

        const value = dialog
            .locator('.mm-blocks-date-input')
            .filter({hasText: 'Event Date'})
            .locator('.date-time-input__value');
        await expect(value).toBeVisible();
        const text = (await value.innerText()).trim();
        expect(text).toMatch(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/);
        expect(Number(text.match(/\d{1,2}/)?.[0])).toBe(Number(target.day));
    });

    test('datetime respects 12h and 24h military time preference', {tag: [...dialogTags]}, async ({pw, request}) => {
        const {channelsPage, marker, openButtonName, user, userClient} = await setupDialogOpenPost(pw, request, {
            scenario: 'datetime_basic',
            buttonText: 'Open datetime 24h',
            titleHint: 'mm_blocks datetime 24h',
        });

        await userClient.savePreferences(user.id, [
            {
                user_id: user.id,
                category: 'display_settings',
                name: 'use_military_time',
                value: 'true',
            },
        ]);
        await channelsPage.page.reload();
        await channelsPage.toBeVisible();

        const dialog = await openBlocksDialogFromPost(channelsPage, marker, openButtonName);
        const field = dialog.locator('.mm-blocks-datetime-input').filter({hasText: 'Meeting Time'});
        await field.locator('.dateTime__date .date-time-input').click();
        const target = getSelectableDay(3);
        await selectDayFromPicker(channelsPage.page, target.day, target.needsNextMonth);
        await field.locator('button[data-testid="time_button"]').click();
        await expect(channelsPage.page.locator('[id$="expiryTimeMenu"]')).toBeVisible();
        const text24 = await channelsPage.page.locator('[id^="time_option_"]').first().innerText();
        expect(text24.trim()).toMatch(/^\d{2}:\d{2}$/);

        // No need to close the dialog — reload clears the modal for the 12h half.
        await userClient.savePreferences(user.id, [
            {
                user_id: user.id,
                category: 'display_settings',
                name: 'use_military_time',
                value: 'false',
            },
        ]);
        await channelsPage.page.reload();
        await channelsPage.toBeVisible();

        // Re-open from the same post button after reload.
        const lastPost = await channelsPage.getLastPost();
        await lastPost.container.getByRole('button', {name: openButtonName}).click();
        const dialog12 = channelsPage.page.locator('#appsModal');
        await expect(dialog12).toBeVisible();
        const field12 = dialog12.locator('.mm-blocks-datetime-input').filter({hasText: 'Meeting Time'});
        await field12.locator('.dateTime__date .date-time-input').click();
        const target2 = getSelectableDay(4);
        await selectDayFromPicker(channelsPage.page, target2.day, target2.needsNextMonth);
        await field12.locator('button[data-testid="time_button"]').click();
        await expect(channelsPage.page.locator('[id$="expiryTimeMenu"]')).toBeVisible();
        const text12 = await channelsPage.page.locator('[id^="time_option_"]').first().innerText();
        expect(text12.trim()).toMatch(/\d{1,2}:\d{2} [AP]M/);
    });

    test('manual time entry accepts formats and rejects invalid', {tag: [...dialogTags]}, async ({pw, request}) => {
        const {channelsPage, marker, openButtonName} = await setupDialogOpenPost(pw, request, {
            scenario: 'datetime_manual',
            buttonText: 'Open datetime manual',
            titleHint: 'mm_blocks datetime manual',
        });

        const dialog = await openBlocksDialogFromPost(channelsPage, marker, openButtonName);
        const field = dialog.locator('.mm-blocks-datetime-input').filter({hasText: 'Your Local Time'});
        const timeInput = field.locator('input#time_input');

        await timeInput.fill('3:45pm');
        await timeInput.blur();
        await expect(timeInput).not.toHaveClass(/error/);
        await expect(timeInput).toHaveValue('3:45 PM');

        await timeInput.fill('abc');
        await timeInput.blur();
        await expect(timeInput).toHaveClass(/error/);

        await timeInput.fill('14:30');
        await timeInput.blur();
        await expect(timeInput).not.toHaveClass(/error/);
        await expect(timeInput).toHaveValue('2:30 PM');
    });

    test(
        'timezone indicator shows for location_timezone Europe/London',
        {tag: [...dialogTags]},
        async ({pw, request}) => {
            const userTimezone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
            test.skip(
                userTimezone === 'Europe/London' || userTimezone === 'GMT' || userTimezone.includes('London'),
                'Cannot assert London timezone conversion when already in London/GMT',
            );

            const {channelsPage, marker, openButtonName} = await setupDialogOpenPost(pw, request, {
                scenario: 'datetime_timezone',
                buttonText: 'Open datetime timezone',
                titleHint: 'mm_blocks datetime timezone',
            });

            const dialog = await openBlocksDialogFromPost(channelsPage, marker, openButtonName);
            const field = dialog.locator('.mm-blocks-datetime-input').filter({hasText: 'London Office Hours'});
            await expect(field.getByText(/Times in (GMT|BST|UTC|Europe\/London)/i)).toBeVisible();

            await field.locator('.dateTime__date .date-time-input').click();
            const target = getSelectableDay(3);
            await selectDayFromPicker(channelsPage.page, target.day, target.needsNextMonth);
            await field.locator('button[data-testid="time_button"]').click();
            await expect(channelsPage.page.locator('[id$="expiryTimeMenu"]')).toBeVisible();
            const first = (await channelsPage.page.locator('[id^="time_option_"]').first().innerText()).trim();
            expect(first).toMatch(/^(12:00 AM|00:00)$/);
        },
    );
});
