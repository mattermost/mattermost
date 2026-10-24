// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {LogNodeKey, LogObject} from '@mattermost/types/admin';

export type LogObjectWithAdditionalInfo = LogObject & {
    [LogNodeKey]?: string;
    [key: string]: unknown;
};
