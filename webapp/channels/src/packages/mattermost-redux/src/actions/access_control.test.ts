// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';

import type {AccessControlPolicy} from '@mattermost/types/access_control';

import {AdminTypes} from 'mattermost-redux/action_types';
import * as AccessControlActions from 'mattermost-redux/actions/access_control';
import {Client4} from 'mattermost-redux/client';

import TestHelper from '../../test/test_helper';
import configureStore from '../../test/test_store';

describe('Actions.AccessControl', () => {
    let store = configureStore();

    beforeAll(() => {
        TestHelper.initBasic(Client4);
    });

    beforeEach(() => {
        store = configureStore();
    });

    afterAll(() => {
        TestHelper.tearDown();
    });

    describe('deleteAccessControlPolicy', () => {
        const policy = {id: 'policy1', name: 'Policy 1', type: 'team'} as AccessControlPolicy;

        const seedPolicy = () => {
            store.dispatch({type: AdminTypes.RECEIVED_ACCESS_CONTROL_POLICY, data: policy});
        };

        it('removes the policy from state and reports success on a 200 OK body', async () => {
            seedPolicy();
            expect(store.getState().entities.admin.accessControlPolicies.policy1).toBeDefined();

            nock(Client4.getBaseRoute()).
                delete('/access_control_policies/policy1').
                query(true).
                reply(200, {status: 'OK'});

            const result: any = await store.dispatch(AccessControlActions.deleteAccessControlPolicy('policy1'));

            expect(result.error).toBeUndefined();
            expect(store.getState().entities.admin.accessControlPolicies.policy1).toBeUndefined();
        });

        it('returns an error and keeps the policy on a server failure', async () => {
            seedPolicy();

            nock(Client4.getBaseRoute()).
                delete('/access_control_policies/policy1').
                query(true).
                reply(403, {message: 'forbidden'});

            const result: any = await store.dispatch(AccessControlActions.deleteAccessControlPolicy('policy1'));

            expect(result.error).toBeDefined();
            expect(store.getState().entities.admin.accessControlPolicies.policy1).toBeDefined();
        });
    });
});
