// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useIntl} from 'react-intl';

// Day-of-week bitmask constants (matching Go model)
const Sunday = 1 << 0; // 1
const Monday = 1 << 1; // 2
const Tuesday = 1 << 2; // 4
const Wednesday = 1 << 3; // 8
const Thursday = 1 << 4; // 16
const Friday = 1 << 5; // 32
const Saturday = 1 << 6; // 64

const Weekdays = Monday | Tuesday | Wednesday | Thursday | Friday; // 62
const Weekend = Saturday | Sunday; // 65
const EveryDay = Weekdays | Weekend; // 127

type DayInfo = {
    bit: number;
    key: string;
};

const DAYS: DayInfo[] = [
    {bit: Sunday, key: 'sun'},
    {bit: Monday, key: 'mon'},
    {bit: Tuesday, key: 'tue'},
    {bit: Wednesday, key: 'wed'},
    {bit: Thursday, key: 'thu'},
    {bit: Friday, key: 'fri'},
    {bit: Saturday, key: 'sat'},
];

export function useScheduleDisplay() {
    const {formatMessage, formatDate, formatTime} = useIntl();

    const formatDaysOfWeek = (daysOfWeek: number): string => {
        // Check for special groupings
        if (daysOfWeek === EveryDay) {
            return formatMessage({id: 'recaps.scheduled.days.everyday', defaultMessage: 'Every day'});
        }
        if (daysOfWeek === Weekdays) {
            return formatMessage({id: 'recaps.scheduled.days.weekdays', defaultMessage: 'Weekdays'});
        }
        if (daysOfWeek === Weekend) {
            return formatMessage({id: 'recaps.scheduled.days.weekend', defaultMessage: 'Weekends'});
        }

        // Build abbreviated day list
        const selectedDays = DAYS.
            filter((day) => (daysOfWeek & day.bit) !== 0).
            map((day) => formatMessage({id: `recaps.scheduled.days.${day.key}`, defaultMessage: day.key.charAt(0).toUpperCase() + day.key.slice(1)}));

        return selectedDays.join(', ');
    };

    const formatTimeOfDay = (timeOfDay: string): string => {
        // timeOfDay is "HH:MM" format
        const [hours, minutes] = timeOfDay.split(':').map(Number);
        const date = new Date();
        date.setHours(hours, minutes, 0, 0);

        // Use locale-appropriate time format (12-hour by default)
        return formatTime(date, {hour: 'numeric', minute: '2-digit'});
    };

    const formatSchedule = (daysOfWeek: number, timeOfDay: string): string => {
        const days = formatDaysOfWeek(daysOfWeek);
        const time = formatTimeOfDay(timeOfDay);
        return formatMessage(
            {id: 'recaps.scheduled.scheduleFormat', defaultMessage: '{days} at {time}'},
            {days, time},
        );
    };

    const formatNextRun = (nextRunAt: number, enabled: boolean): string | null => {
        // Paused schedules hide next run
        if (!enabled || nextRunAt === 0) {
            return null;
        }

        const nextDate = new Date(nextRunAt);
        const now = new Date();
        const diffDays = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        let dateStr: string;
        if (diffDays <= 0) {
            // Today
            dateStr = formatTime(nextDate, {hour: 'numeric', minute: '2-digit'});
        } else if (diffDays === 1) {
            // Tomorrow
            dateStr = `Tomorrow at ${formatTime(nextDate, {hour: 'numeric', minute: '2-digit'})}`;
        } else if (diffDays <= 7) {
            // Within a week - show day name
            dateStr = formatDate(nextDate, {weekday: 'long'}) + ' at ' + formatTime(nextDate, {hour: 'numeric', minute: '2-digit'});
        } else {
            // Beyond a week - show date
            dateStr = formatDate(nextDate, {month: 'short', day: 'numeric'}) + ' at ' + formatTime(nextDate, {hour: 'numeric', minute: '2-digit'});
        }

        return formatMessage(
            {id: 'recaps.scheduled.nextRun', defaultMessage: 'Next: {date}'},
            {date: dateStr},
        );
    };

    const formatLastRun = (lastRunAt: number): string => {
        if (lastRunAt === 0) {
            return formatMessage({id: 'recaps.scheduled.neverRun', defaultMessage: 'Never run'});
        }

        const date = new Date(lastRunAt);
        const dateStr = formatDate(date, {month: 'short', day: 'numeric', year: 'numeric'});
        return formatMessage(
            {id: 'recaps.scheduled.lastRun', defaultMessage: 'Last run: {date}'},
            {date: dateStr},
        );
    };

    const formatRunCount = (count: number): string => {
        return formatMessage(
            {id: 'recaps.scheduled.runCount', defaultMessage: '{count} {count, plural, one {run} other {runs}}'},
            {count},
        );
    };

    return {
        formatDaysOfWeek,
        formatTimeOfDay,
        formatSchedule,
        formatNextRun,
        formatLastRun,
        formatRunCount,
    };
}

export default useScheduleDisplay;
