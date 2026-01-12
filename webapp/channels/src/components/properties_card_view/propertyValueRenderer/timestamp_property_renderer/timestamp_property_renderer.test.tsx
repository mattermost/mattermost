// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyValue} from '@mattermost/types/properties';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import TimestampPropertyRenderer from './timestamp_property_renderer';

describe('TimestampPropertyRenderer', () => {
    const mockValue = {
        value: 1642694400000, // January 20, 2022 12:00:00 PM UTC
    } as PropertyValue<number>;

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
            <TimestampPropertyRenderer value={mockValue}/>,
            baseState,
        );

        const timestampElement = screen.getByTestId('timestamp-property');
        expect(timestampElement).toBeVisible();
        expect(timestampElement).toHaveTextContent('Thursday, January 20, 2022 at 4:00:00 PM');
    });

    it('should handle zero timestamp value', () => {
        const zeroValue = {
            value: 0,
        } as PropertyValue<number>;

        renderWithContext(
            <TimestampPropertyRenderer value={zeroValue}/>,
            baseState,
        );

        const timestampElement = screen.getByTestId('timestamp-property');
        expect(timestampElement).toBeVisible();
        expect(timestampElement).toHaveTextContent('Thursday, January 1, 1970 at 12:00:00 AM');
    });

    it('should handle negative timestamp value', () => {
        const negativeValue = {
            value: -86400000, // One day before epoch
        } as PropertyValue<number>;

        renderWithContext(
            <TimestampPropertyRenderer value={negativeValue}/>,
            baseState,
        );

        const timestampElement = screen.getByTestId('timestamp-property');
        expect(timestampElement).toBeVisible();
        expect(timestampElement).toHaveTextContent('Wednesday, December 31, 1969 at 12:00:00 AM');
    });

    it('should handle future timestamp value', () => {
        const futureValue = {
            value: 2000000000000, // May 18, 2033
        } as PropertyValue<number>;

        renderWithContext(
            <TimestampPropertyRenderer value={futureValue}/>,
            baseState,
        );

        const timestampElement = screen.getByTestId('timestamp-property');
        expect(timestampElement).toBeVisible();
        expect(timestampElement).toHaveTextContent('Wednesday, May 18, 2033 at 3:33:20 AM');
    });

    it('should render in 12-hour format by default', () => {
        const timeValue = {
            value: 1642701600000, // January 20, 2022 2:00:00 PM UTC
        } as PropertyValue<number>;

        renderWithContext(
            <TimestampPropertyRenderer value={timeValue}/>,
            baseState,
        );

        const timestampElement = screen.getByTestId('timestamp-property');
        expect(timestampElement).toBeVisible();
        expect(timestampElement).toHaveTextContent('Thursday, January 20, 2022 at 6:00:00 PM');
    });

    it('should render in 24-hour format when military time preference is enabled', () => {
        const timeValue = {
            value: 1642701600000, // January 20, 2022 2:00:00 PM UTC
        } as PropertyValue<number>;

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
            <TimestampPropertyRenderer value={timeValue}/>,
            militaryTimeState,
        );

        const timestampElement = screen.getByTestId('timestamp-property');
        expect(timestampElement).toBeVisible();
        expect(timestampElement).toHaveTextContent('Thursday, January 20, 2022 at 18:00:00');
    });

    it('should render in 12-hour format when military time preference is disabled', () => {
        const timeValue = {
            value: 1642701600000, // January 20, 2022 2:00:00 PM UTC
        } as PropertyValue<number>;

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
            <TimestampPropertyRenderer value={timeValue}/>,
            twelveHourState,
        );

        const timestampElement = screen.getByTestId('timestamp-property');
        expect(timestampElement).toBeVisible();
        expect(timestampElement).toHaveTextContent('Thursday, January 20, 2022 at 6:00:00 PM');
    });
});
