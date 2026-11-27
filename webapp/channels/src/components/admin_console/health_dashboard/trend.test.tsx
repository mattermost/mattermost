// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createIntl} from 'react-intl';

import {formatDuration} from './trend';

const minute = 60000;
const hour = 60 * minute;
const day = 24 * hour;

describe('components/admin_console/health_dashboard/trend', () => {
    const {formatMessage} = createIntl({locale: 'en', defaultLocale: 'en', onError: () => {}});

    test.each([
        [0, '1 minute'],
        [30000, '1 minute'],
        [5 * minute, '5 minutes'],
        [45 * minute, '45 minutes'],
        [59 * minute, '59 minutes'],
        [(59 * minute) + 40000, '1 hour'],
        [125 * minute, '2 hours'],
        [(21 * hour) + (33 * minute), '22 hours'],
        [(23 * hour) + (40 * minute), '1 day'],
        [28 * hour, '1 day'],
        [(2 * day) + (20 * minute), '2 days'],
        [(3 * day) + (2 * hour), '3 days'],
        [(3 * day) + (13 * hour), '4 days'],
        [40 * day, '40 days'],
    ])('formatDuration(%i) is %s', (ms, expected) => {
        expect(formatDuration(ms, formatMessage)).toBe(expected);
    });
});
