// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {LogNodeKey, LogObject} from '@mattermost/types/admin';

export type LogObjectWithAdditionalInfo = LogObject & {
    [LogNodeKey]?: string;
    [key: string]: unknown;
};

// Absolute bounds in epoch milliseconds, both inclusive
export type CustomTimeRange = {
    from: number;
    to: number;
};

// A preset's length in minutes, or an absolute range
export type TimeRange = number | CustomTimeRange | null;
