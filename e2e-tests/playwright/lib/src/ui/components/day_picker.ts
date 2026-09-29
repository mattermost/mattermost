// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

const monthNames = Array.from({length: 12}, (_, month) =>
    new Date(2000, month).toLocaleString('en-US', {month: 'long'}),
);

/**
 * Formats a month the way a react-day-picker calendar captions it, e.g. "October 2026".
 */
function formatMonthCaption(date: Date): string {
    return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Pages a react-day-picker calendar to the month containing the given date.
 *
 * A calendar opens on the month of its current selection, not necessarily the
 * current month (a rescheduled post opens on the month it was scheduled for), so
 * the displayed month is read from the calendar's caption rather than assumed. The
 * caption has no role to locate it by, hence the class selector.
 *
 * @param container - element the calendar is rendered within
 * @param date - date whose month the calendar should display
 */
export async function goToDayPickerMonth(container: Locator, date: Date): Promise<void> {
    const caption = container.locator('.rdp-caption_label');
    const [monthName, year] = (await caption.innerText()).split(' ');
    const displayedMonth = new Date(Number(year), monthNames.indexOf(monthName));

    const monthsAhead =
        (date.getFullYear() - displayedMonth.getFullYear()) * 12 + date.getMonth() - displayedMonth.getMonth();
    const step = Math.sign(monthsAhead);
    const navButton = container.getByRole('button', {name: step > 0 ? 'Go to next month' : 'Go to previous month'});

    for (let i = 0; i < Math.abs(monthsAhead); i++) {
        displayedMonth.setMonth(displayedMonth.getMonth() + step);
        await navButton.click();

        // Let each page turn render so the next click pages on from the new month
        await expect(caption).toHaveText(formatMonthCaption(displayedMonth));
    }
}

/**
 * Locates a day in a react-day-picker calendar by day-of-month.
 *
 * Day cells carry the `gridcell` role and their accessible name is the bare day
 * number. Pickers configured with `showOutsideDays` also render the surrounding
 * month's days, which repeats those names, so the spill-over days are excluded to
 * keep the match unambiguous.
 *
 * @param container - element the calendar is rendered within
 * @param dayOfMonth - day number to locate, as displayed in the calendar
 */
export function getDayPickerDayCell(container: Locator, dayOfMonth: number): Locator {
    return container
        .getByRole('gridcell', {name: String(dayOfMonth), exact: true})
        .and(container.locator('.rdp-day:not(.rdp-day_outside)'));
}
