// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';

import * as Actions from 'mattermost-redux/actions/limits';
import {Client4} from 'mattermost-redux/client';

import TestHelper from '../../test/test_helper';
import configureStore from '../../test/test_store';

describe('getUsersLimits', () => {
    const URL_USERS_LIMITS = '/limits/users';

    const defaultUserLimitsState = {
        activeUserCount: 0,
        maxUsersLimit: 0,
    };

    let store = configureStore();

    beforeAll(() => {
        TestHelper.initBasic(Client4);
        Client4.setEnableLogging(true);
    });

    beforeEach(() => {
        store = configureStore({
            entities: {
                users: {
                    currentUserId: 'current_user_id',
                    profiles: {
                        current_user_id: {
                            roles: 'system_admin',
                        },
                    },
                },
            },
        });
    });

    afterEach(() => {
        nock.cleanAll();
    });

    afterAll(() => {
        TestHelper.tearDown();
        Client4.setEnableLogging(false);
    });

    test('should return default state for non admin users', async () => {
        store = configureStore({
            entities: {
                users: {
                    currentUserId: 'current_user_id',
                    profiles: {
                        current_user_id: {
                            roles: 'system_user',
                        },
                    },
                },
            },
        });

        const {data} = await store.dispatch(Actions.getUsersLimits());
        expect(data).toEqual(defaultUserLimitsState);
    });

    test('should not return default state for non admin users', async () => {
        const {data} = await store.dispatch(Actions.getUsersLimits());
        expect(data).not.toEqual(defaultUserLimitsState);
    });

    test('should return data if user is admin', async () => {
        const userLimits = {
            activeUserCount: 600,
            maxUsersLimit: 10000,
        };

        nock(Client4.getBaseRoute()).
            get(URL_USERS_LIMITS).
            reply(200, userLimits);

        const {data} = await store.dispatch(Actions.getUsersLimits());
        expect(data).toEqual(userLimits);
    });

    test('should return error if the request fails', async () => {
        const errorMessage = 'test error message';
        nock(Client4.getBaseRoute()).
            get(URL_USERS_LIMITS).
            reply(400, {message: errorMessage});

        const {error} = await store.dispatch(Actions.getUsersLimits());
        console.log(error);
        expect(error.message).toEqual(errorMessage);
    });
});
