// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {LogObject} from '@mattermost/types/admin';

// "2026-10-20 11:39:58.721 +02:00" isn't ISO 8601, and Safari can't parse it
function parseLogTimestamp(timestamp: string): number {
    return Date.parse(timestamp.replace(' ', 'T').replace(' ', ''));
}

// Entries keep their identity across polls, so each one is parsed once rather than on every pass
const entryTimes = new WeakMap<LogObject, number>();

export function logEntryTime(entry: LogObject): number {
    let time = entryTimes.get(entry);
    if (time === undefined) {
        time = parseLogTimestamp(entry.timestamp);
        entryTimes.set(entry, time);
    }
    return time;
}

// Every field counts: concurrent requests log the same message, caller and millisecond
export function logEntryKey(entry: LogObject): string {
    return Object.keys(entry).sort().map((field) => `${field}=${JSON.stringify(entry[field as keyof LogObject])}`).join('|');
}
