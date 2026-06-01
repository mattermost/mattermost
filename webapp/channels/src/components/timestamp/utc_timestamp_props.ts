// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Props as TimestampProps} from './timestamp';

const ABSOLUTE_DATE: TimestampProps['useDate'] = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
};

const ABSOLUTE_TIME: TimestampProps['useTime'] = {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'short',
};

export const UTC_TIMESTAMP_PROPS: Partial<TimestampProps> = {
    timeZone: 'UTC',
    useRelative: false,
    useDate: ABSOLUTE_DATE,
    useTime: ABSOLUTE_TIME,
};
