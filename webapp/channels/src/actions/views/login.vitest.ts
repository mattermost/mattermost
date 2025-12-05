// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Mock} from 'vitest';

import {Client4} from 'mattermost-redux/client';

import {
    login,
    loginById,
} from 'actions/views/login';
import configureStore from 'store';

vi.mock('mattermost-redux/client', () => ({
    Client4: {
        login: vi.fn(),
        loginById: vi.fn(),
    },
}));

const mockUser = {
    id: 'user123',
    username: 'testuser',
    email: 'test@example.com',
    roles: 'system_user',
};

describe('actions/views/login', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('login', () => {
        test('should return successful when login is successful', async () => {
            const store = configureStore();

            (Client4.login as Mock).mockResolvedValue(mockUser);

            const result = await store.dispatch(login('user', 'password', ''));

            expect(Client4.login).toHaveBeenCalledWith('user', 'password', '');
            expect(result).toEqual({data: true});
        });

        test('should return error when when login fails', async () => {
            const store = configureStore();

            const mockError = {message: 'Login failed', status_code: 500};
            (Client4.login as Mock).mockRejectedValue(mockError);

            const result = await store.dispatch(login('user', 'password', ''));

            expect(Object.keys(result)[0]).toEqual('error');
        });
    });

    describe('loginById', () => {
        test('should return successful when login is successful', async () => {
            const store = configureStore();

            (Client4.loginById as Mock).mockResolvedValue(mockUser);

            const result = await store.dispatch(loginById('userId', 'password'));

            expect(Client4.loginById).toHaveBeenCalledWith('userId', 'password', '');
            expect(result).toEqual({data: true});
        });

        test('should return error when when login fails', async () => {
            const store = configureStore();

            const mockError = {message: 'Login failed', status_code: 500};
            (Client4.loginById as Mock).mockRejectedValue(mockError);

            const result = await store.dispatch(loginById('userId', 'password'));

            expect(Object.keys(result)[0]).toEqual('error');
        });
    });
});
