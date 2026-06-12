// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TimestampFormat} from '@mattermost/types/config';
import type {GlobalState} from '@mattermost/types/store';
import type {DeepPartial} from '@mattermost/types/utilities';

import {getShowTimestampSeconds, getTimestampFormat, shouldShowThreadDateSeparators} from 'mattermost-redux/selectors/entities/preferences';

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

    test('does not show seconds when relative format is selected', () => {
        const state = {
            ...baseState,
            entities: {
                ...baseState.entities,
                general: {
                    config: {
                        DefaultTimestampFormat: TimestampFormat.RELATIVE,
                        ShowTimestampSeconds: 'true',
                    },
                },
                preferences: {
                    myPreferences: {
                        'display_settings--show_timestamp_seconds': {
                            category: 'display_settings',
                            name: 'show_timestamp_seconds',
                            value: 'true',
                        },
                    },
                },
            },
        } as unknown as GlobalState;

        expect(getTimestampFormat(state)).toBe(TimestampFormat.RELATIVE);
        expect(getShowTimestampSeconds(state)).toBe(false);
    });
});
