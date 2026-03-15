// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {DaysOfWeek} from '@mattermost/types/recaps';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import ScheduleConfiguration from './schedule_configuration';

describe('ScheduleConfiguration', () => {
    const baseProps = {
        daysOfWeek: DaysOfWeek.Saturday,
        setDaysOfWeek: jest.fn(),
        timeOfDay: '09:00',
        setTimeOfDay: jest.fn(),
        timePeriod: 'last_24h',
        setTimePeriod: jest.fn(),
        customInstructions: '',
        setCustomInstructions: jest.fn(),
    };

    const getInitialState = (timezone: string) => ({
        entities: {
            users: {
                currentUserId: 'user-1',
                profiles: {
                    'user-1': {
                        id: 'user-1',
                        username: 'user-1',
                        timezone: {
                            useAutomaticTimezone: false,
                            automaticTimezone: '',
                            manualTimezone: timezone,
                        },
                    },
                },
            },
        },
    });

    const renderComponent = (timezone: string, props = {}) => {
        return renderWithContext(
            <ScheduleConfiguration
                {...baseProps}
                {...props}
            />,
            getInitialState(timezone),
        );
    };

    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('shows Today when the selected timezone is already on the scheduled day', () => {
        jest.setSystemTime(new Date('2026-03-06T18:00:00.000Z'));

        renderComponent('Asia/Tokyo');

        expect(screen.getByText(/Next recap: Today at /)).toBeInTheDocument();
        expect(screen.queryByText(/Next recap: Tomorrow at /)).not.toBeInTheDocument();
    });

    it('shows Tomorrow when the selected timezone has not reached the scheduled day yet', () => {
        jest.setSystemTime(new Date('2026-03-06T02:00:00.000Z'));

        renderComponent('America/Los_Angeles', {
            daysOfWeek: DaysOfWeek.Friday,
        });

        expect(screen.getByText(/Next recap: Tomorrow at /)).toBeInTheDocument();
        expect(screen.queryByText(/Next recap: Today at /)).not.toBeInTheDocument();
    });
});
