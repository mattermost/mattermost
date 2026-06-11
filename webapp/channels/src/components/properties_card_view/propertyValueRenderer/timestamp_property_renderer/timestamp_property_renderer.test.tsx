// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {TimestampFormat} from '@mattermost/types/config';
import type {PropertyValue} from '@mattermost/types/properties';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import TimestampPropertyRenderer from './timestamp_property_renderer';

describe('TimestampPropertyRenderer', () => {
    const mockValue = {
        value: 1642694400000, // January 20, 2022 12:00:00 PM UTC
    } as PropertyValue<number>;

    const baseState = {
        entities: {
            general: {
                config: {
                    DefaultTimestampFormat: TimestampFormat.STANDARD,
                },
            },
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

    it('should render standard timestamp by default', () => {
        renderWithContext(
            <TimestampPropertyRenderer value={mockValue}/>,
            baseState,
        );

        const timestampElement = screen.getByTestId('timestamp-property');
        expect(timestampElement).toBeVisible();
        expect(timestampElement).toHaveTextContent('4:00 PM');
    });

    it('should render date and time when configured', () => {
        const dateAndTimeState = {
            ...baseState,
            entities: {
                ...baseState.entities,
                general: {
                    config: {
                        DefaultTimestampFormat: TimestampFormat.DATE_AND_TIME,
                    },
                },
            },
        };

        renderWithContext(
            <TimestampPropertyRenderer value={mockValue}/>,
            dateAndTimeState,
        );

        const timestampElement = screen.getByTestId('timestamp-property');
        expect(timestampElement).toBeVisible();
        expect(timestampElement).toHaveTextContent('Jan 20 2022, 4:00 PM');
    });

    it('should handle zero timestamp value in standard format', () => {
        const zeroValue = {
            value: 0,
        } as PropertyValue<number>;

        renderWithContext(
            <TimestampPropertyRenderer value={zeroValue}/>,
            baseState,
        );

        const timestampElement = screen.getByTestId('timestamp-property');
        expect(timestampElement).toBeVisible();
        expect(timestampElement).toHaveTextContent('12:00 AM');
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
        expect(timestampElement).toHaveTextContent('18:00');
    });

    it('should render date and time in 24-hour format when military time preference is enabled', () => {
        const timeValue = {
            value: 1642701600000, // January 20, 2022 2:00:00 PM UTC
        } as PropertyValue<number>;

        const militaryTimeState = {
            ...baseState,
            entities: {
                ...baseState.entities,
                general: {
                    config: {
                        DefaultTimestampFormat: TimestampFormat.DATE_AND_TIME,
                    },
                },
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
        expect(timestampElement).toHaveTextContent('Jan 20 2022, 18:00');
    });
});
