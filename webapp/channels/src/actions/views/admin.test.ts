// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MockStoreEnhanced} from 'redux-mock-store';

import {setAdminConsoleUsersManagementTableProperties, setAdminConsoleTeamsManagementTableProperties, setAdminConsoleChannelsManagementTableProperties} from 'actions/views/admin';

import mockStore from 'tests/test_store';
import {ActionTypes} from 'utils/constants';

import type {GlobalState} from 'types/store';

describe('test admin state', () => {
    describe('set Admin Console settings', () => {
        const initialState = {
            views: {
                admin: {
                    adminConsoleChannelManagementTableProperties: {},
                    adminConsoleTeamManagementTableProperties: {},
                    adminConsoleUserManagementTableProperties: {},
                },
            },
        };

        let store: MockStoreEnhanced<GlobalState>;
        beforeEach(() => {
            store = mockStore(initialState);
        });

        test('set dispatches the right action', async () => {
            const settings = {
                pageIndex: 10,
                searchTerm: 'hello',
                searchOpts: {},
            };

            await store.dispatch(setAdminConsoleTeamsManagementTableProperties(settings));
            const compareStore = mockStore(initialState);
            await compareStore.dispatch({
                type: ActionTypes.SET_ADMIN_CONSOLE_TEAM_MANAGEMENT_TABLE_PROPERTIES,
                data: settings,
            });
            expect(store.getActions()).toEqual(compareStore.getActions());
        });

        test('resets global state for Team Management Table Properties', async () => {
            await store.dispatch(setAdminConsoleTeamsManagementTableProperties());
            const compareStore = mockStore(initialState);
            compareStore.dispatch({
                type: ActionTypes.CLEAR_ADMIN_CONSOLE_TEAM_MANAGEMENT_TABLE_PROPERTIES,
                data: null,
            });
            expect(store.getActions()).toEqual(compareStore.getActions());
        });

        test('sets global state for Channel Management Table Properties', async () => {
            const settings = {
                pageIndex: 10,
                searchTerm: 'hello',
                searchOpts: {},
            };

            await store.dispatch(setAdminConsoleChannelsManagementTableProperties(settings));
            const compareStore = mockStore(initialState);
            compareStore.dispatch({
                type: ActionTypes.SET_ADMIN_CONSOLE_CHANNEL_MANAGEMENT_TABLE_PROPERTIES,
                data: settings,
            });
            expect(store.getActions()).toEqual(compareStore.getActions());
        });

        test('resets global state for channel Management Table Properties', async () => {
            await store.dispatch(setAdminConsoleChannelsManagementTableProperties());
            const compareStore = mockStore(initialState);
            compareStore.dispatch({
                type: ActionTypes.CLEAR_ADMIN_CONSOLE_CHANNEL_MANAGEMENT_TABLE_PROPERTIES,
                data: null,
            });
            expect(store.getActions()).toEqual(compareStore.getActions());
        });

        test('sets global state for User Management Table Properties', async () => {
            const settings = {
                pageIndex: 10,
                searchTerm: 'hello',
                sortColumn: 'id',
                sortIsDescending: true,
            };

            await store.dispatch(setAdminConsoleUsersManagementTableProperties(settings));
            const compareStore = mockStore(initialState);
            compareStore.dispatch({
                type: ActionTypes.SET_ADMIN_CONSOLE_USER_MANAGEMENT_TABLE_PROPERTIES,
                data: settings,
            });
            expect(store.getActions()).toEqual(compareStore.getActions());
        });

        test('resets global state for User Management Table Properties', async () => {
            await store.dispatch(setAdminConsoleUsersManagementTableProperties());
            const compareStore = mockStore(initialState);
            compareStore.dispatch({
                type: ActionTypes.CLEAR_ADMIN_CONSOLE_USER_MANAGEMENT_TABLE_PROPERTIES,
                data: null,
            });
            expect(store.getActions()).toEqual(compareStore.getActions());
        });
    });
});
