// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ActionTypes} from 'utils/constants';

import {needsLoggedInLimitReachedCheck, adminConsoleTeamManagementTableProperties, adminConsoleChannelManagementTableProperties, adminConsoleUserManagementTableProperties,
    adminConsoleTeamManagementTablePropertiesInitialState, adminConsoleChannelManagementTablePropertiesInitialState, adminConsoleUserManagementTablePropertiesInitialState} from './admin';

describe('views/admin reducers', () => {
    describe('needsLoggedInLimitReachedCheck', () => {
        it('defaults to false', () => {
            const actual = needsLoggedInLimitReachedCheck(undefined, {type: 'asdf'});
            expect(actual).toBe(false);
        });

        it('is set by NEEDS_LOGGED_IN_LIMIT_REACHED_CHECK', () => {
            const falseValue = needsLoggedInLimitReachedCheck(
                undefined,
                {type: ActionTypes.NEEDS_LOGGED_IN_LIMIT_REACHED_CHECK, data: false},
            );
            expect(falseValue).toBe(false);

            const trueValue = needsLoggedInLimitReachedCheck(
                false,
                {type: ActionTypes.NEEDS_LOGGED_IN_LIMIT_REACHED_CHECK, data: true},
            );
            expect(trueValue).toBe(true);
        });
    });

    describe('team reducer', () => {
        const newState = {
            pageIndex: 2,
            searchTerms: 'hello',
            searchOpts: {},
        };

        test('set state to new state', () => {
            const actual = adminConsoleTeamManagementTableProperties(adminConsoleTeamManagementTablePropertiesInitialState, {type: ActionTypes.SET_ADMIN_CONSOLE_TEAM_MANAGEMENT_TABLE_PROPERTIES, data: newState});
            expect(actual).toBe(newState);
        });

        test('clear state', () => {
            const actual = adminConsoleTeamManagementTableProperties(adminConsoleTeamManagementTablePropertiesInitialState, {type: ActionTypes.CLEAR_ADMIN_CONSOLE_TEAM_MANAGEMENT_TABLE_PROPERTIES, data: newState});
            expect(actual).toBe(adminConsoleTeamManagementTablePropertiesInitialState);
        });
    });

    describe('channel reducer', () => {
        const newState = {
            pageIndex: 2,
            searchTerms: 'hello',
            searchOpts: {},
        };

        test('set state to new state', () => {
            const actual = adminConsoleChannelManagementTableProperties(adminConsoleChannelManagementTablePropertiesInitialState, {type: ActionTypes.SET_ADMIN_CONSOLE_CHANNEL_MANAGEMENT_TABLE_PROPERTIES, data: newState});
            expect(actual).toBe(newState);
        });

        test('clear state', () => {
            const actual = adminConsoleChannelManagementTableProperties(adminConsoleChannelManagementTablePropertiesInitialState, {type: ActionTypes.CLEAR_ADMIN_CONSOLE_CHANNEL_MANAGEMENT_TABLE_PROPERTIES, data: newState});
            expect(actual).toBe(adminConsoleChannelManagementTablePropertiesInitialState);
        });
    });

    describe('user reducer', () => {
        const newState = {
            pageIndex: 10,
            searchTerm: 'hello',
            sortColumn: 'id',
            sortIsDescending: true,
        };

        test('set state to new state', () => {
            const actual = adminConsoleUserManagementTableProperties(adminConsoleUserManagementTablePropertiesInitialState, {type: ActionTypes.SET_ADMIN_CONSOLE_USER_MANAGEMENT_TABLE_PROPERTIES, data: newState});
            expect(actual).toBe(newState);
        });

        test('clear state', () => {
            const actual = adminConsoleUserManagementTableProperties(adminConsoleUserManagementTablePropertiesInitialState, {type: ActionTypes.CLEAR_ADMIN_CONSOLE_USER_MANAGEMENT_TABLE_PROPERTIES, data: newState});
            expect(actual).toBe(adminConsoleUserManagementTablePropertiesInitialState);
        });
    });
});
