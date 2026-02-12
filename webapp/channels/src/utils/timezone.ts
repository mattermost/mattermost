// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Moment} from 'moment-timezone';
import moment from 'moment-timezone';

export function getBrowserTimezone() {
    return new Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function getBrowserUtcOffset() {
    return moment().utcOffset();
}

export function getUtcOffsetForTimeZone(timezone: string) {
    return moment.tz(timezone).utcOffset();
}

export function getCurrentDateForTimezone(timezone: string) {
    const tztime = moment().tz(timezone);
    return new Date(tztime.year(), tztime.month(), tztime.date());
}

export function getCurrentDateTimeForTimezone(timezone: string) {
    const tztime = moment().tz(timezone);
    return new Date(tztime.year(), tztime.month(), tztime.date(), tztime.hour(), tztime.minute(), tztime.second());
}

export function getCurrentMomentForTimezone(timezone?: string) {
    return timezone ? moment.tz(timezone) : moment();
}

export function isBeforeTime(dateTime1: Moment, dateTime2: Moment) {
    const a = dateTime1.clone().set({year: 0, month: 0, date: 1});
    const b = dateTime2.clone().set({year: 0, month: 0, date: 1});

    return a.isBefore(b);
}

export function isValidTimezone(timezone: string): boolean {
    return moment.tz.zone(timezone) !== null;
}

export function parseDateInTimezone(value: string, timezone?: string): Moment | null {
    if (!timezone || !isValidTimezone(timezone)) {
        const parsed = moment(value);
        return parsed.isValid() ? parsed : null;
    }

    // Detect date-only strings (YYYY-MM-DD format, no time component)
    const isDateOnly = (/^\d{4}-\d{2}-\d{2}$/).test(value);

    if (isDateOnly) {
        // For date-only strings, parse AS IF in the target timezone
        // '2025-01-15' in EST should be Jan 15 in EST, not converted from UTC
        const parsed = moment.tz(value, timezone);
        return parsed.isValid() ? parsed : null;
    }

    // For datetime strings (with time/UTC indicator), parse as UTC then convert
    // '2025-01-15T14:30:00Z' is absolute UTC time, convert to target timezone
    const parsed = moment.utc(value).tz(timezone);
    return parsed.isValid() ? parsed : null;
}
