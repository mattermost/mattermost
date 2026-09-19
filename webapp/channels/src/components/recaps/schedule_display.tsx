// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useIntl} from 'react-intl';

import {Weekdays, Weekend, EveryDay} from '@mattermost/types/recaps';

import {DAY_DESCRIPTORS} from './day_descriptors';
import {formatRelativeScheduleTime} from './schedule_time_format';

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

        // Build abbreviated day list from the shared static descriptors
        const selectedDays = DAY_DESCRIPTORS.
            filter((day) => (daysOfWeek & day.bit) !== 0).
            map((day) => formatMessage(day.abbrev));

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

    const formatNextRun = (nextRunAt: number, enabled: boolean, timezone?: string): string | null => {
        // Paused schedules hide next run
        if (!enabled || nextRunAt === 0) {
            return null;
        }

        const now = Date.now();
        if (nextRunAt <= now) {
            return null;
        }

        // Format in the schedule's timezone so the list matches the time the user configured.
        const dateStr = formatRelativeScheduleTime(
            {formatMessage, formatDate, formatTime},
            nextRunAt,
            now,
            timezone,
            {includeTimezoneAbbreviation: true},
        );

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
