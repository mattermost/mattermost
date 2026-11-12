// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TimestampFormat} from '@mattermost/types/config';
import type {PreferencesType} from '@mattermost/types/preferences';
import type {UserProfile} from '@mattermost/types/users';

import {Preferences} from 'utils/constants';

import type {GlobalState} from 'types/store';

import {getMapStateToProps} from './index';

function pref(name: string, value: string) {
    return {user_id: 'u', category: Preferences.CATEGORY_DISPLAY_SETTINGS, name, value};
}

describe('date and time setting mapStateToProps', () => {
    const state = {
        entities: {
            general: {config: {DateTimeDisplayFormat: TimestampFormat.STANDARD, ShowTimestampSeconds: 'false'}},
            preferences: {
                myPreferences: {
                    [`${Preferences.CATEGORY_DISPLAY_SETTINGS}--${Preferences.USE_MILITARY_TIME}`]: pref(Preferences.USE_MILITARY_TIME, 'false'),
                },
            },
        },
    } as unknown as GlobalState;

    const ownProps = {
        user: {id: 'target'} as UserProfile,
        active: true,
        areAllSectionsInactive: false,
        updateSection: jest.fn(),
    };

    test('uses the current user preferences outside admin mode', () => {
        const props = getMapStateToProps(state, ownProps);
        expect(props.militaryTime).toBe('false');
        expect(props.timestampFormat).toBe(TimestampFormat.STANDARD);
    });

    test('uses the target user preferences in admin mode', () => {
        const userPreferences: PreferencesType = {
            [`${Preferences.CATEGORY_DISPLAY_SETTINGS}--${Preferences.USE_MILITARY_TIME}`]: pref(Preferences.USE_MILITARY_TIME, 'true'),
            [`${Preferences.CATEGORY_DISPLAY_SETTINGS}--${Preferences.DATETIME_DISPLAY_FORMAT}`]: pref(Preferences.DATETIME_DISPLAY_FORMAT, TimestampFormat.RELATIVE),
            [`${Preferences.CATEGORY_DISPLAY_SETTINGS}--${Preferences.SHOW_TIMESTAMP_SECONDS}`]: pref(Preferences.SHOW_TIMESTAMP_SECONDS, 'true'),
        };

        const props = getMapStateToProps(state, {...ownProps, adminMode: true, userPreferences});
        expect(props.militaryTime).toBe('true');
        expect(props.timestampFormat).toBe(TimestampFormat.RELATIVE);

        // The stored seconds setting is kept even though Relative does not display seconds
        expect(props.showTimestampSeconds).toBe('true');
    });
});
