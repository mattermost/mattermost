// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';

import {Client4} from 'mattermost-redux/client';

import {
    getUserLoginType,
    login,
    loginById,
} from 'actions/views/login';
import configureStore from 'store';

import TestHelper from 'packages/mattermost-redux/test/test_helper';

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

    describe('getUserLoginType', () => {
        test('should return the login type reported by the server', async () => {
            const store = configureStore();

            TestHelper.initBasic(Client4);
            nock(Client4.getBaseRoute()).
                post('/users/login/type').
                reply(200, {auth_service: 'magic_link'});

            const result = await store.dispatch(getUserLoginType('user@example.com'));

            expect(result).toEqual({data: {auth_service: 'magic_link', is_deactivated: false}});
        });

        test('should surface the server message when the endpoint is unavailable', async () => {
            const store = configureStore();

            TestHelper.initBasic(Client4);
            nock(Client4.getBaseRoute()).
                post('/users/login/type').
                reply(404, {
                    id: 'api.user.login.guest_magic_link.disabled.error',
                    message: 'Login with magic link is disabled.',
                    status_code: 404,
                });

            const result = await store.dispatch(getUserLoginType('user@example.com'));

            expect(result.error?.message).toEqual('Login with magic link is disabled.');
            expect(result.error?.server_error_id).toEqual('api.user.login.guest_magic_link.disabled.error');
        });

        test('should report an invalid response when the server sends an empty body as JSON', async () => {
            const store = configureStore();

            TestHelper.initBasic(Client4);
            nock(Client4.getBaseRoute()).
                post('/users/login/type').
                reply(404, '', {'Content-Type': 'application/json'});

            const result = await store.dispatch(getUserLoginType('user@example.com'));

            expect(result.error?.message).toEqual('Received invalid response from the server.');
        });
    });
});
