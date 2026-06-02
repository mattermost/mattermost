// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {TimestampFormat} from '@mattermost/types/config';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import EventTimestamp from './event_timestamp';

describe('EventTimestamp', () => {
    const baseProps = {
        value: new Date('2020-06-01T16:32:00.000Z'),
        timestampFormat: TimestampFormat.DATE_AND_TIME,
        showTimestampSeconds: false,
        useMilitaryTime: false,
    };

    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2020-06-15T12:00:00.000Z'));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('should render date and time inline', () => {
        renderWithContext(
            <EventTimestamp
                {...baseProps}
                showTooltip={false}
            />,
        );

        expect(screen.getByText('Jun 1, 4:32 PM')).toBeInTheDocument();
    });

    test('should render time only when space is constrained', () => {
        renderWithContext(
            <EventTimestamp
                {...baseProps}
                showTooltip={false}
                forceTimeOnly={true}
            />,
        );

        expect(screen.getByText('4:32 PM')).toBeInTheDocument();
        expect(screen.queryByText(/Jun 1,/)).not.toBeInTheDocument();
    });

    test('should omit seconds when space is constrained', () => {
        renderWithContext(
            <EventTimestamp
                {...baseProps}
                showTimestampSeconds={true}
                showTooltip={false}
                forceTimeOnly={true}
            />,
        );

        expect(screen.getByText('4:32 PM')).toBeInTheDocument();
        expect(screen.queryByText(/:00/)).not.toBeInTheDocument();
    });

    test('should render inline tier for thread list in standard mode', () => {
        renderWithContext(
            <EventTimestamp
                {...baseProps}
                timestampFormat={TimestampFormat.STANDARD}
                displayContext='thread_list'
                showTooltip={false}
            />,
        );

        expect(screen.getByText('Jun 1, 4:32 PM')).toBeInTheDocument();
    });
});
