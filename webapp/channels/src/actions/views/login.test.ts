// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';

import {Client4} from 'mattermost-redux/client';

import TestHelper from 'packages/mattermost-redux/test/test_helper';

import {
    login,
    loginById,
} from 'actions/views/login';
import configureStore from 'store';

describe('actions/views/login', () => {
    describe('login', () => {
        test('should return successful when login is successful', async () => {
            const store = configureStore();

            TestHelper.initBasic(Client4);
            nock(Client4.getBaseRoute()).
                post('/users/login').
                reply(200, {...TestHelper.basicUser});

            const result = await store.dispatch(login('user', 'password', ''));

            expect(result).toEqual({data: true});
        });

        test('should return error when when login fails', async () => {
            const store = configureStore();

            TestHelper.initBasic(Client4);
            nock(Client4.getBaseRoute()).
                post('/users/login').
                reply(500, {});

            const result = await store.dispatch(login('user', 'password', ''));

            expect(Object.keys(result)[0]).toEqual('error');
        });
    });

    describe('loginById', () => {
        test('should return successful when login is successful', async () => {
            const store = configureStore();

            TestHelper.initBasic(Client4);
            nock(Client4.getBaseRoute()).
                post('/users/login').
                reply(200, {...TestHelper.basicUser});

            const result = await store.dispatch(loginById('userId', 'password'));

            expect(result).toEqual({data: true});
        });

        test('should return error when when login fails', async () => {
            const store = configureStore();

            TestHelper.initBasic(Client4);
            nock(Client4.getBaseRoute()).
                post('/users/login').
                reply(500, {});

            const result = await store.dispatch(loginById('userId', 'password'));

            expect(Object.keys(result)[0]).toEqual('error');
        });
    });
});
