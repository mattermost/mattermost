// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useIntl} from 'react-intl';

import {DaysOfWeek, Weekdays, Weekend, EveryDay} from '@mattermost/types/recaps';

const {Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday} = DaysOfWeek;

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

        const timeStr = formatTime(nextDate, {hour: 'numeric', minute: '2-digit'});
        let dateStr: string;
        if (diffDays <= 0) {
            dateStr = timeStr;
        } else if (diffDays === 1) {
            dateStr = formatMessage(
                {id: 'recaps.nextRun.tomorrow', defaultMessage: 'Tomorrow at {time}'},
                {time: timeStr},
            );
        } else if (diffDays <= 7) {
            dateStr = formatMessage(
                {id: 'recaps.nextRun.dayAt', defaultMessage: '{day} at {time}'},
                {day: formatDate(nextDate, {weekday: 'long'}), time: timeStr},
            );
        } else {
            dateStr = formatMessage(
                {id: 'recaps.nextRun.dateAt', defaultMessage: '{date} at {time}'},
                {date: formatDate(nextDate, {month: 'short', day: 'numeric'}), time: timeStr},
            );
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
