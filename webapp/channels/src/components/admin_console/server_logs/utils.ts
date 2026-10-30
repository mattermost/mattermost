// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {LogLevelEnum} from '@mattermost/types/admin';

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
