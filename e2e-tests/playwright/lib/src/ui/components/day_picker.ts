// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';

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
