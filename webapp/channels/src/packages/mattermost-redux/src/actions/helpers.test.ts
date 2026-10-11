// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ClientError} from '@mattermost/client';

import {UserTypes} from 'mattermost-redux/action_types';
import {forceLogoutIfNecessary} from 'mattermost-redux/actions/helpers';
import {Client4} from 'mattermost-redux/client';

import configureStore, {mockDispatch} from '../../test/test_store';

describe('Actions.Helpers', () => {
    describe('forceLogoutIfNecessary', () => {
        const token = 'token';

        beforeEach(() => {
            Client4.setToken(token);
        });

        it('should do nothing when passed a client error', async () => {
            const store = configureStore({
                entities: {
                    users: {
                        currentUserId: 'user',
                    },
                },
            });
            const dispatch = mockDispatch(store.dispatch);

            const error = new ClientError(Client4.getUrl(), {
                message: 'no internet connection',
                url: '/api/v4/foo/bar',
            });

            forceLogoutIfNecessary(error, dispatch as any, store.getState);

            expect(Client4.token).toEqual(token);
            expect(dispatch.actions).toEqual([]);
        });

        it('should do nothing when passed a non-401 server error', async () => {
            const store = configureStore({
                entities: {
                    users: {
                        currentUserId: 'user',
                    },
                },
            });
            const dispatch = mockDispatch(store.dispatch);

            const error = new ClientError(Client4.getUrl(), {
                message: 'Failed to do something',
                status_code: 403,
                url: '/api/v4/foo/bar',
            });

            forceLogoutIfNecessary(error, dispatch as any, store.getState);

            expect(Client4.token).toEqual(token);
            expect(dispatch.actions).toEqual([]);
        });

        it('should trigger logout when passed a 401 server error', async () => {
            const store = configureStore({
                entities: {
                    users: {
                        currentUserId: 'user',
                    },
                },
            });
            const dispatch = mockDispatch(store.dispatch);

            const error = new ClientError(Client4.getUrl(), {
                message: 'Failed to do something',
                status_code: 401,
                url: '/api/v4/foo/bar',
            });

            forceLogoutIfNecessary(error, dispatch as any, store.getState);

            expect(Client4.token).not.toEqual(token);
            expect(dispatch.actions).toEqual([{type: UserTypes.LOGOUT_SUCCESS, data: {}}]);
        });

        it('should do nothing when failing to log in', async () => {
            const store = configureStore({
                entities: {
                    users: {
                        currentUserId: 'user',
                    },
                },
            });
            const dispatch = mockDispatch(store.dispatch);

            const error = new ClientError(Client4.getUrl(), {
                message: 'Failed to do something',
                status_code: 401,
                url: '/api/v4/login',
            });

            forceLogoutIfNecessary(error, dispatch as any, store.getState);

            expect(Client4.token).toEqual(token);
            expect(dispatch.actions).toEqual([]);
        });

        it('should do nothing when not logged in', async () => {
            const store = configureStore({
                entities: {
                    users: {
                        currentUserId: '',
                    },
                },
            });
            const dispatch = mockDispatch(store.dispatch);

            const error = new ClientError(Client4.getUrl(), {
                message: 'Failed to do something',
                status_code: 401,
                url: '/api/v4/foo/bar',
            });

            forceLogoutIfNecessary(error, dispatch as any, store.getState);

            expect(Client4.token).toEqual(token);
            expect(dispatch.actions).toEqual([]);
        });

        it.each([
            ['api.channel.dm_gm_start.abac_denied.app_error', 'dm_gm_start'],
            ['api.channel.dm_gm_read_access.abac_denied.app_error', 'dm_gm_read_access'],
            ['api.channel.dm_gm_write_access.abac_denied.app_error', 'dm_gm_write_access'],
        ])('should record a DM/GM denial when passed %s', (serverErrorId, action) => {
            const store = configureStore({
                entities: {
                    general: {config: {FeatureFlagPermissionPolicies: 'true'}},
                    users: {
                        currentUserId: 'user',
                    },
                },
            });
            const dispatch = mockDispatch(store.dispatch);

            const error = new ClientError(Client4.getUrl(), {
                message: 'Failed to do something',
                server_error_id: serverErrorId,
                status_code: 403,
                url: '/api/v4/foo/bar',
            });

            forceLogoutIfNecessary(error, dispatch as any, store.getState);

            expect(Client4.token).toEqual(token);
            expect(dispatch.actions).toHaveLength(1);
            expect(store.getState().entities.renderPermissions.byResource.permission[''][action]).toMatchObject({allowed: false, evaluated: true});
        });

        it('should not record a denial for another 403', () => {
            const store = configureStore({
                entities: {
                    users: {
                        currentUserId: 'user',
                    },
                },
            });
            const dispatch = mockDispatch(store.dispatch);

            const error = new ClientError(Client4.getUrl(), {
                message: 'Failed to do something',
                server_error_id: 'api.channel.channel_write_access.abac_denied.app_error',
                status_code: 403,
                url: '/api/v4/foo/bar',
            });

            forceLogoutIfNecessary(error, dispatch as any, store.getState);

            expect(dispatch.actions).toEqual([]);
        });
    });
});
