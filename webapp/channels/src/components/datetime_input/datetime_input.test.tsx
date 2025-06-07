// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment-timezone';
import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import DateTimeInput, {getTimeInIntervals} from './datetime_input';

describe('components/datetime_input/DateTimeInput', () => {
    const baseProps = {
        time: moment(),
        handleChange: jest.fn(),
        timezone: 'UTC',
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <DateTimeInput {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should get time intervals', () => {
        const startTime = moment.tz('2022-01-01 08:00', 'UTC');
        const times = getTimeInIntervals(startTime, 30);

        expect(times).toHaveLength(32);
        expect(times[0]).toEqual(startTime.toDate());
        expect(times[1]).toEqual(startTime.clone().add(30, 'minutes').toDate());
    });

    test('should render date and time selectors', () => {
        renderWithContext(
            <DateTimeInput {...baseProps}/>,
        );

        expect(screen.getByText('Date')).toBeInTheDocument();
        expect(screen.getByLabelText('Time')).toBeInTheDocument();
    });

    test.each([
        ['2024-03-02T02:00:00+0100', 48],
        ['2024-03-31T02:00:00+0100', 46],
        ['2024-10-07T02:00:00+0100', 48],
        ['2024-10-27T02:00:00+0100', 48],
        ['2025-01-01T03:00:00+0200', 48],
    ])('should not infinitely loop on DST', (time, expected) => {
        const timezone = 'Europe/Paris';

        const intervals = getTimeInIntervals(moment.tz(time, timezone).startOf('day'));
        expect(intervals).toHaveLength(expected);
    });
});
