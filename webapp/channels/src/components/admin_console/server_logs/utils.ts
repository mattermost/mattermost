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
const TIME_FORMAT = 'HH:mm:ss.SSS';

// The entry's time in the admin's timezone. A timestamp that doesn't parse is shown as logged
export function formatLogRowTime(log: LogObjectWithAdditionalInfo, timezone: string, showDate: boolean): string {
    const time = logEntryTime(log);
    if (Number.isNaN(time)) {
        return log.timestamp.slice(0, 23);
    }
    return moment.tz(time, timezone).format(showDate ? `${DAY_FORMAT} ${TIME_FORMAT}` : TIME_FORMAT);
}

// Whether the entries fall on more than one day in the admin's timezone, which rows then need the date to tell apart
export function spansMultipleDays(logs: LogObjectWithAdditionalInfo[], timezone: string): boolean {
    let oldest = Infinity;
    let newest = -Infinity;
    for (const log of logs) {
        const time = logEntryTime(log);
        if (!Number.isNaN(time)) {
            oldest = Math.min(oldest, time);
            newest = Math.max(newest, time);
        }
    }
    if (oldest > newest) {
        return false;
    }
    return moment.tz(oldest, timezone).format(DAY_FORMAT) !== moment.tz(newest, timezone).format(DAY_FORMAT);
}
