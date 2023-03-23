// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GlobalState} from 'types/store';
import {UserTimezone} from '@mattermost/types/users';
import {PreferenceType} from '@mattermost/types/preferences';

import * as Timestamp from './timestamp';

import {makeMapStateToProps} from './index';

const supportsHourCycleOg = Timestamp.supportsHourCycle;
Object.defineProperty(Timestamp, 'supportsHourCycle', {get: () => supportsHourCycleOg});
const supportsHourCycleSpy = jest.spyOn(Timestamp, 'supportsHourCycle', 'get');

describe('mapStateToProps', () => {
    const currentUserId = 'user-id';

    const initialState = {
        entities: {
            general: {
                config: {
                    ExperimentalTimezone: 'true',
                },
            },
            preferences: {
                myPreferences: {},
            },
            users: {
                currentUserId,
                profiles: {
                    [currentUserId]: {
                        id: currentUserId,
                    },
                },
            },
        },
    } as unknown as GlobalState;

    describe('hourCycle', () => {
        test('hourCycle should be h12 when military time is false and the prop was not set', () => {
            const props = makeMapStateToProps()(initialState, {});
            expect(props.hourCycle).toBe('h12');
        });

        test('hourCycle should be h23 when military time is true and the prop was not set', () => {
            const testState = {...initialState};
            testState.entities.preferences.myPreferences['display_settings--use_military_time'] = {
                category: 'display_settings',
                name: 'use_military_time',
                user_id: currentUserId,
                value: 'true',
            } as PreferenceType;

            const props = makeMapStateToProps()(testState, {});
            expect(props.hourCycle).toBe('h23');
        });

        test('hourCycle should have the value of prop.hourCycle when given', () => {
            const testState = {...initialState};
            testState.entities.preferences.myPreferences['display_settings--use_military_time'] = {
                category: 'display_settings',
                name: 'use_military_time',
                user_id: currentUserId,
                value: 'true',
            } as PreferenceType;

            const props = makeMapStateToProps()(testState, {hourCycle: 'h24'});
            expect(props.hourCycle).toBe('h24');
        });
    });

    describe('timeZone', () => {
        test('timeZone should be the user TZ when the prop was not set', () => {
            const testState = {...initialState};
            testState.entities.users.profiles[currentUserId].timezone = {
                useAutomaticTimezone: false,
                manualTimezone: 'Europe/Paris',
            } as UserTimezone;

            const props = makeMapStateToProps()(testState, {});
            expect(props.timeZone).toBe('Europe/Paris');
        });

        test('timeZone should be the value of prop.timeZone when given', () => {
            const testState = {...initialState};
            testState.entities.users.profiles[currentUserId].timezone = {
                useAutomaticTimezone: false,
                manualTimezone: 'Europe/Paris',
            } as UserTimezone;

            const props = makeMapStateToProps()(testState, {timeZone: 'America/Phoenix'});
            expect(props.timeZone).toBe('America/Phoenix');
        });

        test('timeZone should be the value of prop.timeZone when given, even when timezone are disabled', () => {
            const testState = {...initialState};
            testState.entities.general.config.ExperimentalTimezone = 'false';

            const props = makeMapStateToProps()(testState, {timeZone: 'America/Chicago'});
            expect(props.timeZone).toBe('America/Chicago');
        });
    });

    describe('hour12, hourCycle unsupported', () => {
        test('hour12 should be false when using military time', () => {
            const testState = {...initialState};
            testState.entities.preferences.myPreferences['display_settings--use_military_time'] = {
                category: 'display_settings',
                name: 'use_military_time',
                user_id: currentUserId,
                value: 'true',
            } as PreferenceType;
            supportsHourCycleSpy.mockReturnValueOnce(false);

            const props = makeMapStateToProps()(testState, {});
            expect(props.hour12).toBe(false);
        });

        test('hour12 should be true when not using military time', () => {
            const testState = {...initialState};
            testState.entities.preferences.myPreferences['display_settings--use_military_time'] = {
                category: 'display_settings',
                name: 'use_military_time',
                user_id: currentUserId,
                value: 'false',
            } as PreferenceType;
            supportsHourCycleSpy.mockReturnValueOnce(false);

            const props = makeMapStateToProps()(testState, {});
            expect(props.hour12).toBe(true);
        });

        test('hour12 should equal props.hour12 when defined', () => {
            const testState = {...initialState};
            testState.entities.preferences.myPreferences['display_settings--use_military_time'] = {
                category: 'display_settings',
                name: 'use_military_time',
                user_id: currentUserId,
                value: 'false',
            } as PreferenceType;
            supportsHourCycleSpy.mockReturnValueOnce(false);

            const props = makeMapStateToProps()(testState, {hour12: false});
            expect(props.hour12).toBe(false);
        });
    });
});
