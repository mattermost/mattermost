// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, pickDate, type App, type generated} from '@mattermost/playwright-lib';

/**
 * Scheduled messages on the generated page objects: the composers' schedule menu, the date/time dialog, the composer
 * indicator, the sidebar's count, and the scheduled posts page (rows by scheduled post, their actions and dialogs).
 */

export type Scheduled = {selectedDate: string; selectedTime: string};

/**
 * Picks a custom time in an open date/time dialog and confirms it: `dayFromToday` days ahead, the time menu's
 * `timeOptionIndex`th option, weekly when asked. Returns the date as the app shows it for today and tomorrow ("Today",
 * "Tomorrow"), else "<Month> <dd>", and the time as the menu showed it.
 */
export async function pickTime(
    modal: generated.DateTimePickerModal<generated.DateTimePickerModalMount>,
    dayFromToday = 0,
    timeOptionIndex = 0,
    repeatWeekly?: boolean,
): Promise<Scheduled> {
    await expect(modal.when.dateButton).toBeVisible();
    if (typeof repeatWeekly === 'boolean') {
        await modal.repeatWeeklyCheckbox.set(repeatWeekly);
        if (repeatWeekly) {
            await expect(modal.repeatWeeklyCheckbox).toBeChecked();
        } else {
            await expect(modal.repeatWeeklyCheckbox).not.toBeChecked();
        }
    }

    const target = new Date();
    target.setDate(target.getDate() + dayFromToday);
    await modal.when.dateButton.clickTo(modal.when.calendar);
    await pickDate(modal.when.calendar, target);
    await expect(modal.when.calendar).not.toBeVisible();
    const dateText = (await modal.when.dateButton.locator.textContent()) ?? '';

    await modal.when.timeButton.click();
    const timeMenu = modal.when.timeMenu;
    await expect(timeMenu.timeList).not.toHaveKeyCount(0);
    const option = timeMenu.time((await timeMenu.timeList.keys())[timeOptionIndex]);
    await expect(option).toBeVisible();

    // read before clicking: the click closes the menu
    const selectedTime = ((await option.locator.textContent()) ?? '').trim();
    await option.click();
    await expect(option).not.toBeVisible();
    await modal.confirmButton.click();
    await expect(modal.when.dateButton).not.toBeVisible();

    let selectedDate = `${target.toLocaleString('default', {month: 'long'})} ${String(target.getDate()).padStart(2, '0')}`;
    if (dateText.includes('Today')) {
        selectedDate = 'Today';
    } else if (dateText.includes('Tomorrow')) {
        selectedDate = 'Tomorrow';
    }
    return {selectedDate, selectedTime};
}

/** Writes a message in a composer and schedules it from the send button's menu ("Choose a custom time"). */
export async function scheduleMessage(
    app: App,
    composer: App['center']['postCreate'] | App['rhs']['postCreate'],
    message: string,
    dayFromToday = 0,
    timeOptionIndex = 0,
    repeatWeekly?: boolean,
): Promise<Scheduled> {
    await composer.message.container.fill(message);

    await expect(composer.message.container).toHaveValue(message);
    await composer.sendOptions.openMenuButton.click();
    await expect(app.sendPostOptions.menu.customTimeMenuItem).toBeVisible();
    const modal = await app.sendPostOptions.menu.customTimeMenuItem.clickTo(app.dateTimePickerModal);
    return pickTime(modal, dayFromToday, timeOptionIndex, repeatWeekly);
}

/** Checks a composer's scheduled-post indicator shows the scheduled time and a date (or Today / Tomorrow). */
export async function expectIndicator(
    indicator:
        App['center']['postCreate']['scheduledPostIndicator'] | App['rhs']['postCreate']['scheduledPostIndicator'],
    scheduled: Scheduled,
) {
    await expect(indicator.icon).toBeVisible();
    await expect(indicator).toContainText(scheduled.selectedTime);
    await expect(indicator).toContainText(new RegExp(`${scheduled.selectedDate}|Today|Tomorrow`, 'i'));
}

/** Checks the sidebar's scheduled-posts count. */
export async function expectSidebarCount(app: App, count: number) {
    await expect(app.lhs.drafts.scheduledPostBadgeText).toHaveText(String(count));
}

/**
 * The scheduled posts page's only row, checked: its message, its time and date, the tab's count, and the weekly tag
 * when it repeats.
 */
export async function expectScheduledPost(
    app: App,
    expected: Scheduled & {message: string; count: number; repeatWeekly?: boolean},
) {
    const {scheduled, tabs} = app.drafts;

    // nothing hovered or focused (the reschedule modal hands focus back to the row), so the
    // row's actions aren't showing over its header
    await app.page.mouse.move(0, 0);
    await app.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await expect(tabs.scheduledCountText).toHaveText(String(expected.count));
    await expect(scheduled.postList).toHaveKeyCount(expected.count);
    const post = await scheduled.postList.itemWith({text: expected.message});
    await expect(post.message).toContainText(expected.message);
    const time = post.header.timeText.locator;
    await expect(time).toContainText(expected.selectedTime);
    await expect(time).toContainText(new RegExp(`${expected.selectedDate}|Today|Tomorrow`, 'i'));
    if (expected.repeatWeekly) {
        await expect(post.header.repeatsWeeklyText).toBeVisible();
    }
    return post;
}
