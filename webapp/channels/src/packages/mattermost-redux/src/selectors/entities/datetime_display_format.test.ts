// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTimeDisplayFormat} from '@mattermost/types/config';

import {Preferences} from 'mattermost-redux/constants';
import {getDateTimeDisplayFormat, isCompactDateTimeDisplayFormat} from 'mattermost-redux/selectors/entities/preferences';

describe('getDateTimeDisplayFormat', () => {
    const baseState = {
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
    } as any;

    test('returns user preference when set', () => {
        const state = {
            ...baseState,
            entities: {
                ...baseState.entities,
                preferences: {
                    myPreferences: {
                        [`${Preferences.CATEGORY_DISPLAY_SETTINGS}--${Preferences.DATETIME_DISPLAY_FORMAT}`]: {
                            category: Preferences.CATEGORY_DISPLAY_SETTINGS,
                            name: Preferences.DATETIME_DISPLAY_FORMAT,
                            value: DateTimeDisplayFormat.TIME_SECONDS,
                        },
                    },
                },
            },
        };

        expect(getDateTimeDisplayFormat(state)).toBe(DateTimeDisplayFormat.TIME_SECONDS);
    });

    test('returns config default when user preference is unset', () => {
        expect(getDateTimeDisplayFormat(baseState)).toBe(DateTimeDisplayFormat.ISO_DATETIME);
    });

    test('returns compact when config is invalid', () => {
        const state = {
            ...baseState,
            entities: {
                ...baseState.entities,
                general: {
                    config: {
                        DateTimeDisplayFormat: 'invalid',
                    },
                },
            },
        };

        expect(getDateTimeDisplayFormat(state)).toBe(DateTimeDisplayFormat.COMPACT);
        expect(isCompactDateTimeDisplayFormat(state)).toBe(true);
    });
});
