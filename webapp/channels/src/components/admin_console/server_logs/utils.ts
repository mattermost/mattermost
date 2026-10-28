// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {LogNodeKey} from '@mattermost/types/admin';

import {parseLogTimestamp} from 'mattermost-redux/utils/log_utils';

import type {LogObjectWithAdditionalInfo} from './types';

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
        const time = parseLogTimestamp(log.timestamp);
        if (log.failed_node !== true && !Number.isNaN(time) && !(newest[node] >= time)) {
            newest[node] = time;
        }
    }
    return newest;
}
