// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';

import type {ClickableDriver} from '@/aria/drivers';
import {expect} from '@/aria/matchers';
import {duration} from '@/util';

/** An open date picker's calendar: the element holding it and its month buttons. */
export type Calendar = {
    readonly locator: Locator;
    readonly nextMonth: ClickableDriver;
    readonly previousMonth: ClickableDriver;
};

/** A date as YYYY-MM-DD in the browser's time zone. */
export function calendarDayKey(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * The days of the month a react-day-picker calendar shows, inside `root` (the picker's element): the library gives its
 * days no test ids, so they are its own day buttons, without the outside days of the neighbouring months.
 */
export function monthDays(root: Locator): Locator {
    return root.locator('button[name="day"]:not(.rdp-day_outside)');
}

/** The year and month ("2026-11") a calendar shows, read from its caption. */
async function shownMonth(calendar: Calendar): Promise<string> {
    const caption = calendar.locator.locator('.rdp-caption_label');
    await caption.first().waitFor();
    const shown = new Date(`${(await caption.first().innerText()).trim()} 1 12:00`);
    return calendarDayKey(shown).slice(0, 7);
}

/** Clicks next or previous month until the calendar shows `target`'s month. The calendar has to be open. */
export async function showMonth(calendar: Calendar, target: Date): Promise<void> {
    const wanted = calendarDayKey(target).slice(0, 7);
    for (let i = 0; i < 24; i++) {
        const shown = await shownMonth(calendar);
        if (shown === wanted) {
            return;
        }
        await (shown < wanted ? calendar.nextMonth : calendar.previousMonth).click();

        // the calendar redraws in place: wait until it shows another month
        await expect
            .poll(() => shownMonth(calendar), {
                timeout: duration.ten_sec,
                message: `The calendar still shows ${shown} after clicking to ${wanted}`,
            })
            .not.toBe(shown);
    }
    throw new Error(`The calendar did not reach ${wanted}`);
}

/** Shows `date`'s month and clicks its day. The calendar has to be open. */
export async function pickDate(calendar: Calendar, date: Date): Promise<void> {
    await showMonth(calendar, date);
    await monthDays(calendar.locator).getByText(String(date.getDate()), {exact: true}).click();
}
