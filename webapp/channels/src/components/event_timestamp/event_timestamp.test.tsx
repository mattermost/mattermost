// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {DateTimeDisplayFormat} from '@mattermost/types/config';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import EventTimestamp from './event_timestamp';

describe('EventTimestamp', () => {
    const baseProps = {
        value: 1642694400000,
        dateTimeDisplayFormat: DateTimeDisplayFormat.ISO_DATETIME,
        useMilitaryTime: false,
    };

    const initialState = {
        entities: {
            general: {
                config: {
                    DateTimeDisplayFormat: DateTimeDisplayFormat.ISO_DATETIME,
                },
            },
            preferences: {
                myPreferences: {},
            },
        },
    };

    test('should render date and time inline by default', () => {
        renderWithContext(
            <EventTimestamp
                {...baseProps}
                showTooltip={false}
            />,
            initialState,
        );

        expect(screen.getByText(/2022-01-20/)).toBeInTheDocument();
    });

    test('should render compact inline when forceCompactFormat is true', () => {
        renderWithContext(
            <EventTimestamp
                {...baseProps}
                showTooltip={false}
                forceCompactFormat={true}
            />,
            initialState,
        );

        expect(screen.queryByText(/2022-01-20/)).not.toBeInTheDocument();
        expect(screen.getByText(/\d{1,2}:\d{2}\s?(AM|PM)/)).toBeInTheDocument();
    });

    test('should honor timestampProps over configured format', () => {
        renderWithContext(
            <EventTimestamp
                {...baseProps}
                showTooltip={false}
                timestampProps={{
                    useTime: false,
                    day: 'numeric',
                    units: ['now', 'minute', 'hour', 'day', 'week'],
                }}
            />,
            initialState,
        );

        expect(screen.queryByText(/2022-01-20 4:00:00 PM/)).not.toBeInTheDocument();
        expect(screen.getByText(/January 20, 2022/)).toBeInTheDocument();
    });
});
