// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment-timezone';
import {defineMessages} from 'react-intl';
import type {IntlShape} from 'react-intl';

const messages = defineMessages({
    today: {id: 'recaps.nextRun.today', defaultMessage: 'Today at {time}'},
    tomorrow: {id: 'recaps.nextRun.tomorrow', defaultMessage: 'Tomorrow at {time}'},
    dayAt: {id: 'recaps.nextRun.dayAt', defaultMessage: '{day} at {time}'},
    dateAt: {id: 'recaps.nextRun.dateAt', defaultMessage: '{date} at {time}'},
});

type ScheduleIntl = Pick<IntlShape, 'formatMessage' | 'formatDate' | 'formatTime'>;

type FormatOptions = {

    // Append the timezone abbreviation (e.g. "(EST)") so the time is unambiguous outside the browser zone.
    includeTimezoneAbbreviation?: boolean;
};

// Only treat a timezone as usable when moment recognizes it; otherwise fall back to the browser zone.
function resolveZone(timezone?: string): string | undefined {
    return timezone && moment.tz.zone(timezone) ? timezone : undefined;
}

function getTimezoneAbbreviation(zone: string, date: Date): string {
    try {
        return new Intl.DateTimeFormat('en-US', {
            timeZone: zone,
            timeZoneName: 'short',
        }).formatToParts(date).find((part) => part.type === 'timeZoneName')?.value || '';
    } catch {
        return '';
    }
}

// formatRelativeScheduleTime renders an absolute instant as "Today/Tomorrow/Weekday/Date at {time}",
// computing the relative day and time in the schedule's timezone so the list and the create-modal
// preview stay consistent with the time the user configured.
export function formatRelativeScheduleTime(
    intl: ScheduleIntl,
    targetMs: number,
    nowMs: number,
    timezone?: string,
    options: FormatOptions = {},
): string {
    const {formatMessage, formatDate, formatTime} = intl;
    const zone = resolveZone(timezone);
    const target = new Date(targetMs);

    // Compare calendar days in the schedule's zone so the relative label matches the displayed time.
    const nowDay = (zone ? moment.tz(nowMs, zone) : moment(nowMs)).startOf('day');
    const targetDay = (zone ? moment.tz(targetMs, zone) : moment(targetMs)).startOf('day');
    const diffDays = targetDay.diff(nowDay, 'days');

    const timeOptions: Intl.DateTimeFormatOptions = {hour: 'numeric', minute: '2-digit'};
    if (zone) {
        timeOptions.timeZone = zone;
    }
    const time = formatTime(target, timeOptions);

    let dateStr: string;
    if (diffDays <= 0) {
        dateStr = formatMessage(messages.today, {time});
    } else if (diffDays === 1) {
        dateStr = formatMessage(messages.tomorrow, {time});
    } else if (diffDays <= 7) {
        const dayOptions: Intl.DateTimeFormatOptions = {weekday: 'long'};
        if (zone) {
            dayOptions.timeZone = zone;
        }
        dateStr = formatMessage(messages.dayAt, {day: formatDate(target, dayOptions), time});
    } else {
        const dateOptions: Intl.DateTimeFormatOptions = {month: 'short', day: 'numeric'};
        if (zone) {
            dateOptions.timeZone = zone;
        }
        dateStr = formatMessage(messages.dateAt, {date: formatDate(target, dateOptions), time});
    }

    if (options.includeTimezoneAbbreviation && zone) {
        const abbrev = getTimezoneAbbreviation(zone, target);
        if (abbrev) {
            return `${dateStr} (${abbrev})`;
        }
    }

    return dateStr;
}
