// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import TimestampPropertyRenderer from './timestamp_property_renderer';

describe('TimestampPropertyRenderer', () => {
    const mockValue = {
        value: 1642694400000, // January 20, 2022 12:00:00 PM UTC
    };

    const baseState = {
        entities: {
            preferences: {
                myPreferences: {},
            },
            users: {
                currentUserId: 'user-id',
                profiles: {
                    'user-id': {
                        id: 'user-id',
                        timezone: {
                            useAutomaticTimezone: false,
                            manualTimezone: 'UTC',
                        },
                    },
                },
            },
        },
    };

    it('should render timestamp component with the provided value', () => {
        renderWithContext(
            <TimestampPropertyRenderer value={mockValue} />,
            baseState,
        );

        const timestampElement = screen.getByTestId('timestamp-property');
        expect(timestampElement).toBeVisible();

        // The Timestamp component should be rendered inside
        const timestampContent = timestampElement.querySelector('time');
        expect(timestampContent).toBeVisible();

        // Check that the timestamp displays the expected date format
        expect(timestampElement).toHaveTextContent('Thursday, 20 January 2022');
        expect(timestampElement).toHaveTextContent('12:00:00');
    });

    it('should handle zero timestamp value', () => {
        const zeroValue = {
            value: 0,
        };

        renderWithContext(
            <TimestampPropertyRenderer value={zeroValue} />,
            baseState,
        );

        const timestampElement = screen.getByTestId('timestamp-property');
        expect(timestampElement).toBeVisible();

        // Check that epoch time (0) renders correctly
        expect(timestampElement).toHaveTextContent('Thursday, 1 January 1970');
        expect(timestampElement).toHaveTextContent('00:00:00');
    });

    it('should handle negative timestamp value', () => {
        const negativeValue = {
            value: -86400000, // One day before epoch
        };

        renderWithContext(
            <TimestampPropertyRenderer value={negativeValue} />,
            baseState,
        );

        const timestampElement = screen.getByTestId('timestamp-property');
        expect(timestampElement).toBeVisible();

        // Check that negative timestamp (one day before epoch) renders correctly
        expect(timestampElement).toHaveTextContent('Wednesday, 31 December 1969');
        expect(timestampElement).toHaveTextContent('00:00:00');
    });

    it('should handle future timestamp value', () => {
        const futureValue = {
            value: 2000000000000, // May 18, 2033
        };

        renderWithContext(
            <TimestampPropertyRenderer value={futureValue} />,
            baseState,
        );

        const timestampElement = screen.getByTestId('timestamp-property');
        expect(timestampElement).toBeVisible();

        // Check that future timestamp renders correctly
        expect(timestampElement).toHaveTextContent('Wednesday, 18 May 2033');
        expect(timestampElement).toHaveTextContent('03:33:20');
    });

    it('should render in 12-hour format by default', () => {
        const timeValue = {
            value: 1642701600000, // January 20, 2022 2:00:00 PM UTC
        };

        renderWithContext(
            <TimestampPropertyRenderer value={timeValue} />,
            baseState,
        );

        const timestampElement = screen.getByTestId('timestamp-property');
        expect(timestampElement).toBeVisible();
        
        // Should display 12-hour format with AM/PM
        expect(timestampElement).toHaveTextContent('14:00:00');
    });

    it('should render in 24-hour format when military time preference is enabled', () => {
        const timeValue = {
            value: 1642701600000, // January 20, 2022 2:00:00 PM UTC
        };

        const militaryTimeState = {
            ...baseState,
            entities: {
                ...baseState.entities,
                preferences: {
                    myPreferences: {
                        'display_settings--use_military_time': {
                            category: 'display_settings',
                            name: 'use_military_time',
                            user_id: 'user-id',
                            value: 'true',
                        },
                    },
                },
            },
        };

        renderWithContext(
            <TimestampPropertyRenderer value={timeValue} />,
            militaryTimeState,
        );

        const timestampElement = screen.getByTestId('timestamp-property');
        expect(timestampElement).toBeVisible();
        
        // Should display 24-hour format without AM/PM
        expect(timestampElement).toHaveTextContent('14:00');
        expect(timestampElement).not.toHaveTextContent('PM');
    });

    it('should render in 12-hour format when military time preference is disabled', () => {
        const timeValue = {
            value: 1642701600000, // January 20, 2022 2:00:00 PM UTC
        };

        const twelveHourState = {
            ...baseState,
            entities: {
                ...baseState.entities,
                preferences: {
                    myPreferences: {
                        'display_settings--use_military_time': {
                            category: 'display_settings',
                            name: 'use_military_time',
                            user_id: 'user-id',
                            value: 'false',
                        },
                    },
                },
            },
        };

        renderWithContext(
            <TimestampPropertyRenderer value={timeValue} />,
            twelveHourState,
        );

        const timestampElement = screen.getByTestId('timestamp-property');
        expect(timestampElement).toBeVisible();
        
        // Should display 12-hour format with AM/PM
        expect(timestampElement).toHaveTextContent('14:00:00');
    });

    it('should apply correct CSS class', () => {
        renderWithContext(
            <TimestampPropertyRenderer value={mockValue} />,
            baseState,
        );

        const element = screen.getByTestId('timestamp-property');
        expect(element).toHaveClass('TimestampPropertyRenderer');
    });

    it('should render as a div element', () => {
        renderWithContext(
            <TimestampPropertyRenderer value={mockValue} />,
            baseState,
        );

        const element = screen.getByTestId('timestamp-property');
        expect(element.tagName).toBe('DIV');
    });
});
