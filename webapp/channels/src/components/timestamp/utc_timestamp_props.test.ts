// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UTC_TIMESTAMP_PROPS} from './utc_timestamp_props';

describe('UTC_TIMESTAMP_PROPS', () => {
    test('should configure absolute UTC formatting', () => {
        expect(UTC_TIMESTAMP_PROPS).toMatchObject({
            timeZone: 'UTC',
            useRelative: false,
            useDate: {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            },
            useTime: {
                hour: '2-digit',
                minute: '2-digit',
                hourCycle: 'h23',
                timeZoneName: 'short',
            },
        });
    });
});
