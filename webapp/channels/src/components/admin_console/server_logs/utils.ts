// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment-timezone';

import {LogLevelEnum, LogNodeKey} from '@mattermost/types/admin';

import {logEntryTime} from 'mattermost-redux/utils/log_utils';

import type {LogObjectWithAdditionalInfo} from './types';

// The level filter offers these four groups, most severe first
export const LEVEL_GROUPS = ['error', 'warn', 'info', 'debug'] as const;
export type LevelGroup = typeof LEVEL_GROUPS[number];

const GROUP_LEVELS: Record<LevelGroup, readonly LogLevelEnum[]> = {
    error: [LogLevelEnum.PANIC, LogLevelEnum.FATAL, LogLevelEnum.CRITICAL, LogLevelEnum.ERROR],
    warn: [LogLevelEnum.WARN],
    info: [LogLevelEnum.INFO, LogLevelEnum.STDLOG],
    debug: [LogLevelEnum.DEBUG, LogLevelEnum.TRACE],
};

const LEVEL_TO_GROUP = new Map<string, LevelGroup>(
    LEVEL_GROUPS.flatMap((group) => GROUP_LEVELS[group].map((level) => [level, group] as const)),
);

// The server levels a group stands for, as sent with the query
export function groupLevels(group: LevelGroup): readonly LogLevelEnum[] {
    return GROUP_LEVELS[group];
}

// Undefined for a level outside every group, such as a custom level
export function levelGroup(level: string): LevelGroup | undefined {
    return LEVEL_TO_GROUP.get(level);
}

// Structured fields can hold nested objects, which String() turns into "[object Object]"
export function formatLogValue(value: unknown): string {
    return typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);
}

export function presetStartMs(minutes: number): number {
    return Date.now() - (minutes * 60 * 1000);
}

// The newest entry's time per node. A failed-node entry carries the time of the request,
// not of a logged line, so it doesn't count
export function newestLogTimes(logs: LogObjectWithAdditionalInfo[]): Record<string, number> {
    const newest: Record<string, number> = {};
    for (const log of logs) {
        const node = log[LogNodeKey] ?? '';
        const time = logEntryTime(log);
        if (log.failed_node !== true && !Number.isNaN(time) && !(newest[node] >= time)) {
            newest[node] = time;
        }
    }
    return newest;
}

const DAY_FORMAT = 'YYYY-MM-DD';

// The format of a row's time: the admin's clock, with the date when the rows need it
export function logRowTimeFormat(showDate: boolean, useMilitaryTime: boolean): string {
    const time = useMilitaryTime ? 'HH:mm:ss.SSS' : 'h:mm:ss.SSS A';
    return showDate ? `${DAY_FORMAT} ${time}` : time;
}

// The most characters a time in this format takes: a two-digit hour and "PM" are as long as it gets
export function logRowTimeLength(format: string): number {
    return moment.utc('2000-12-31T22:59:59.999Z').format(format).length;
}

// The entry's time in the admin's timezone. A timestamp that doesn't parse is shown as logged, and cut to the column by CSS
export function formatLogRowTime(log: LogObjectWithAdditionalInfo, timezone: string, format: string): string {
    const time = logEntryTime(log);
    if (Number.isNaN(time)) {
        return log.timestamp;
    }
    return moment.tz(time, timezone).format(format);
}

// When the admin's day ends, which turns today's bare times into yesterday's
export function msUntilNextDay(timezone: string, now = Date.now()): number {
    return (moment.tz(now, timezone).endOf('day').valueOf() + 1) - now;
}

// A bare time reads as today, so rows need the date as soon as any entry is from another day
export function logsNeedDate(logs: LogObjectWithAdditionalInfo[], timezone: string, now = Date.now()): boolean {
    const today = moment.tz(now, timezone);
    const startOfToday = today.clone().startOf('day').valueOf();
    const endOfToday = today.endOf('day').valueOf();
    return logs.some((log) => {
        const time = logEntryTime(log);
        return time < startOfToday || time > endOfToday;
    });
}
