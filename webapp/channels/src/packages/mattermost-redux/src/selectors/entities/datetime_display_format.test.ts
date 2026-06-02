// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TimestampFormat} from '@mattermost/types/config';
import type {DeepPartial} from '@mattermost/types/utilities';

import {getShowTimestampSeconds, getTimestampFormat, shouldShowThreadDateSeparators} from 'mattermost-redux/selectors/entities/preferences';

import type {GlobalState} from 'types/store';

describe('timestamp format selectors', () => {
    const baseState: DeepPartial<GlobalState> = {
        entities: {
            general: {
                config: {
                    DefaultTimestampFormat: TimestampFormat.DATE_AND_TIME,
                    ShowTimestampSeconds: 'false',
                },
            },
            preferences: {
                myPreferences: {},
                userPreferences: {},
            },
        },
    };

    test('uses user preference when set', () => {
        const state = {
            ...baseState,
            entities: {
                ...baseState.entities,
                preferences: {
                    myPreferences: {
                        'display_settings--timestamp_format': {
                            category: 'display_settings',
                            name: 'timestamp_format',
                            value: TimestampFormat.RELATIVE,
                        },
                    },
                },
            },
        } as unknown as GlobalState;

        expect(getTimestampFormat(state)).toBe(TimestampFormat.RELATIVE);
        expect(shouldShowThreadDateSeparators(state)).toBe(false);
    });

    test('falls back to config default', () => {
        const state = baseState as unknown as GlobalState;

        expect(getTimestampFormat(state)).toBe(TimestampFormat.DATE_AND_TIME);
        expect(shouldShowThreadDateSeparators(state)).toBe(false);
    });

    test('maps legacy preference values', () => {
        const state = {
            ...baseState,
            entities: {
                ...baseState.entities,
                preferences: {
                    myPreferences: {
                        'display_settings--datetime_display_format': {
                            category: 'display_settings',
                            name: 'datetime_display_format',
                            value: 'iso_datetime',
                        },
                    },
                },
            },
        } as unknown as GlobalState;

        expect(getTimestampFormat(state)).toBe(TimestampFormat.DATE_AND_TIME);
    });

    test('show seconds from legacy time_seconds format', () => {
        const state = {
            ...baseState,
            entities: {
                ...baseState.entities,
                preferences: {
                    myPreferences: {
                        'display_settings--datetime_display_format': {
                            category: 'display_settings',
                            name: 'datetime_display_format',
                            value: 'time_seconds',
                        },
                    },
                },
            },
        } as unknown as GlobalState;

        expect(getShowTimestampSeconds(state)).toBe(true);
    });
});
