// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {createIntl} from 'react-intl';

import {act, renderWithContext} from 'tests/react_testing_utils';

import RelativeTime from './relative_time';
import {formatDuration} from './trend';

const minute = 60000;
const hour = 60 * minute;
const day = 24 * hour;

describe('components/admin_console/health_dashboard/relative_time', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-05-03T12:00:00Z'));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('just now turns into minutes ago as time passes', () => {
        const {container} = renderWithContext(<RelativeTime value={Date.now() - 40000}/>);

        expect(container.textContent).toEqual('just now');

        act(() => {
            jest.advanceTimersByTime(15000);
        });

        expect(container.textContent).toEqual('1 minute ago');
    });

    test.each([
        [45 * minute, '45 minutes ago'],
        [(59 * minute) + 40000, '1 hour ago'],
        [(21 * hour) + (33 * minute), '22 hours ago'],
        [(23 * hour) + (40 * minute), '1 day ago'],
        [(2 * day) + (20 * minute), '2 days ago'],
        [(3 * day) + (13 * hour), '4 days ago'],
        [40 * day, '40 days ago'],
    ])('%i ms ago reads as %s, in the same unit and rounding as a duration', (ago, expected) => {
        const {container} = renderWithContext(<RelativeTime value={Date.now() - ago}/>);
        const {formatMessage} = createIntl({locale: 'en', defaultLocale: 'en', onError: () => {}});

        expect(container.textContent).toEqual(expected);
        expect(`${formatDuration(ago, formatMessage)} ago`).toEqual(expected);
    });
});
