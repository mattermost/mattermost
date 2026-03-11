// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {LogObject} from '@mattermost/types/admin';

export type LogObjectWithAdditionalInfo = LogObject & {
    [key: string]: string;
};
