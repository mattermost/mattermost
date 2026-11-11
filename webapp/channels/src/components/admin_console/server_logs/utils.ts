// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {LogLevelEnum, LogNodeKey} from '@mattermost/types/admin';

import {logEntryTime} from 'mattermost-redux/utils/log_utils';

import type {LogObjectWithAdditionalInfo} from './types';

// The level filter offers these four groups, most severe first
export const LEVEL_GROUPS = ['error', 'warn', 'info', 'debug'] as const;
export type LevelGroup = typeof LEVEL_GROUPS[number];

// The server rejects longer terms (model.LogFilterSearchMaxLength)
export const SEARCH_MAX_LENGTH = 256;

// The server's limits on field filters (model.LogFilterFieldMaxValues, LogFilterFieldMaxLength)
export const FIELD_MAX_VALUES = 20;
export const FIELD_MAX_LENGTH = 256;

// The field every plugin's log entries carry
export const PLUGIN_ID_FIELD = 'plugin_id';

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
