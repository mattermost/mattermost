// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

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

/**
 * Clicks next/previous month until the visible caption matches `target`'s month and year.
 */
export async function goToDisplayedMonth(container: Locator, target: Date): Promise<void> {
    const targetLabel = target.toLocaleString('default', {month: 'long', year: 'numeric'});
    const caption = container.locator('.rdp-caption_label');
    const nextMonth = container.getByRole('button', {name: /next month/i});
    const previousMonth = container.getByRole('button', {name: /previous month/i});
    const targetYm = target.getFullYear() * 12 + target.getMonth();

    await expect(caption).toBeVisible();

    for (let i = 0; i < 24; i++) {
        const displayed = (await caption.textContent())?.trim() ?? '';
        if (displayed === targetLabel) {
            return;
        }

        const displayedDate = new Date(`${displayed} 1`);
        if (Number.isNaN(displayedDate.getTime())) {
            throw new Error(`Unrecognized calendar caption: ${displayed}`);
        }
        const displayedYm = displayedDate.getFullYear() * 12 + displayedDate.getMonth();
        await (displayedYm < targetYm ? nextMonth : previousMonth).click();
        await expect(caption).not.toHaveText(displayed);
    }

    throw new Error(`Date picker did not reach ${targetLabel}`);
}
