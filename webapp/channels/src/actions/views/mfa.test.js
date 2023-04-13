// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

jest.mock('mattermost-redux/actions/users');

import * as UserActions from 'mattermost-redux/actions/users';

import {
    activateMfa,
    deactivateMfa,
    generateMfaSecret,
} from 'actions/views/mfa';
import configureStore from 'tests/test_store';

describe('actions/views/mfa', () => {
    describe('activateMfa', () => {
        it('should call updateUserMfa to enable MFA for the current user', async () => {
            const currentUserId = 'abcd';
            const store = configureStore({
                entities: {
                    users: {
                        currentUserId,
                    },
                },
            });

            UserActions.updateUserMfa.mockImplementation(() => () => ({data: true}));

            const code = 'mfa code';
            await store.dispatch(activateMfa(code));

            expect(UserActions.updateUserMfa).toHaveBeenCalledWith(currentUserId, true, code);
        });
    });

    describe('deactivateMfa', () => {
        it('should call updateUserMfa to disable MFA for the current user', async () => {
            const currentUserId = 'abcd';
            const store = configureStore({
                entities: {
                    users: {
                        currentUserId,
                    },
                },
            });

            UserActions.updateUserMfa.mockImplementation(() => () => ({data: true}));

            await store.dispatch(deactivateMfa());

            expect(UserActions.updateUserMfa).toHaveBeenCalledWith(currentUserId, false);
        });
    });

    describe('generateMfaSecret', () => {
        it('should call generateMfaSecret for the current user', async () => {
            const currentUserId = 'abcd';
            const store = configureStore({
                entities: {
                    users: {
                        currentUserId,
                    },
                },
            });

            UserActions.generateMfaSecret.mockImplementation(() => () => ({data: '1234'}));

            await store.dispatch(generateMfaSecret());

            expect(UserActions.generateMfaSecret).toHaveBeenCalledWith(currentUserId);
        });
    });
});
