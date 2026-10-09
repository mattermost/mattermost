// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createIntl} from 'react-intl';

import {formatDuration} from './trend';

const minute = 60000;

describe('components/admin_console/health_dashboard/trend', () => {
    const {formatMessage} = createIntl({locale: 'en', defaultLocale: 'en', onError: () => {}});

    test.each([
        [0, '1m'],
        [30000, '1m'],
        [5 * minute, '5m'],
        [60 * minute, '1h'],
        [125 * minute, '2h 5m'],
        [24 * 60 * minute, '1d'],
        [28 * 60 * minute, '1d 4h'],
        [((3 * 24) + 4) * 60 * minute, '3d 4h'],
    ])('formatDuration(%i) is %s', (ms, expected) => {
        expect(formatDuration(ms, formatMessage)).toBe(expected);
    });
});
