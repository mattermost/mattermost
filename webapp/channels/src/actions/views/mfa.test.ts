// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

jest.mock('mattermost-redux/actions/users');

import * as UserActions from 'mattermost-redux/actions/users';

import {
    activateMfa,
    deactivateMfa,
    generateMfaSecret as originalGenerateMfaSecret,
} from 'actions/views/mfa';

const updateUserMfa = jest.mocked(UserActions.updateUserMfa);
const generateMfaSecret = jest.mocked(originalGenerateMfaSecret);

import configureStore from 'tests/test_store';

import type {GlobalState} from 'types/store';

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
            } as GlobalState);

            updateUserMfa.mockImplementation(() => () => ({data: true}) as any);

            const code = 'mfa code';
            await store.dispatch(activateMfa(code));

            expect(updateUserMfa).toHaveBeenCalledWith(currentUserId, true, code);
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
            } as GlobalState);

            updateUserMfa.mockImplementation(() => () => ({data: true}) as any);

            await store.dispatch(deactivateMfa());

            expect(updateUserMfa).toHaveBeenCalledWith(currentUserId, false);
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
            } as GlobalState);

            generateMfaSecret.mockImplementation(() => () => ({data: '1234'}) as any);

            await store.dispatch(generateMfaSecret());

            expect(UserActions.generateMfaSecret).toHaveBeenCalledWith(currentUserId);
        });
    });
});
