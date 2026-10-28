// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {LogObject} from '@mattermost/types/admin';

// "2026-10-20 11:39:58.721 +02:00" isn't ISO 8601, and Safari can't parse it
export function parseLogTimestamp(timestamp: string): number {
    return Date.parse(timestamp.replace(' ', 'T').replace(' ', ''));
}

// Every field counts: concurrent requests log the same message, caller and millisecond
export function logEntryKey(entry: LogObject): string {
    return Object.keys(entry).sort().map((field) => `${field}=${JSON.stringify(entry[field as keyof LogObject])}`).join('|');
}
