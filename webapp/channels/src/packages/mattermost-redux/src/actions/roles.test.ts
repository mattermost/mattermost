// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import cloneDeep from 'lodash/cloneDeep';
import nock from 'nock';

import type {Role} from '@mattermost/types/roles';
import type {GlobalState} from '@mattermost/types/store';
import type {DeepPartial} from '@mattermost/types/utilities';

import * as Actions from 'mattermost-redux/actions/roles';
import {Client4} from 'mattermost-redux/client';

import TestHelper from '../../test/test_helper';
import configureStore from '../../test/test_store';
import {RequestStatus} from '../constants';

type FakeRolesState = {
    entities: {
        general: {
            serverVersion: string | null;
        };
        roles: {
            roles: Record<string, Partial<Role>>;
            pending?: Set<string>;
        };
    };
};

describe('Actions.Roles', () => {
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

    it('getRolesByNames', async () => {
        nock(Client4.getRolesRoute()).
            post('/names').
            reply(200, [TestHelper.basicRoles!.system_admin]);
        await store.dispatch(Actions.getRolesByNames(['system_admin']));

        const state = store.getState();
        const request = state.requests.roles.getRolesByNames;
        const {roles} = state.entities.roles;

        if (request.status === RequestStatus.FAILURE) {
            throw new Error(JSON.stringify(request.error));
        }

        expect(roles.system_admin.name).toEqual('system_admin');
        expect(roles.system_admin.permissions).toEqual(TestHelper.basicRoles!.system_admin.permissions);
    });

    it('getRoleByName', async () => {
        nock(Client4.getRolesRoute()).
            get('/name/system_admin').
            reply(200, TestHelper.basicRoles!.system_admin);
        await store.dispatch(Actions.getRoleByName('system_admin'));

        const state = store.getState();
        const request = state.requests.roles.getRolesByNames;
        const {roles} = state.entities.roles;

        if (request.status === RequestStatus.FAILURE) {
            throw new Error(JSON.stringify(request.error));
        }

        expect(roles.system_admin.name).toEqual('system_admin');
        expect(roles.system_admin.permissions).toEqual(TestHelper.basicRoles!.system_admin.permissions);
    });

    it('getRole', async () => {
        nock(Client4.getRolesRoute()).
            get('/' + TestHelper.basicRoles!.system_admin.id).
            reply(200, TestHelper.basicRoles!.system_admin);

        await store.dispatch(Actions.getRole(TestHelper.basicRoles!.system_admin.id));

        const state = store.getState();
        const request = state.requests.roles.getRole;
        const {roles} = state.entities.roles;

        if (request.status === RequestStatus.FAILURE) {
            throw new Error(JSON.stringify(request.error));
        }

        expect(roles.system_admin.name).toEqual('system_admin');
        expect(roles.system_admin.permissions).toEqual(TestHelper.basicRoles!.system_admin.permissions);
    });

    it('loadRolesIfNeeded', async () => {
        const mock1 = nock(Client4.getRolesRoute()).
            post('/names', JSON.stringify(['test'])).
            reply(200, []);
        const mock2 = nock(Client4.getRolesRoute()).
            post('/names', JSON.stringify(['test2'])).
            reply(200, []);
        let fakeState: FakeRolesState = {
            entities: {
                general: {
                    serverVersion: '4.3',
                },
                roles: {
                    roles: {
                        test: {},
                    },
                },
            },
        };
        store = configureStore(fakeState as unknown as DeepPartial<GlobalState>);
        await store.dispatch(Actions.loadRolesIfNeeded(['test']));
        expect(mock1.isDone()).toBe(false);
        expect(mock2.isDone()).toBe(false);

        fakeState = cloneDeep(fakeState);
        fakeState.entities.roles.pending = new Set();
        fakeState.entities.general.serverVersion = null;
        store = configureStore(fakeState as unknown as DeepPartial<GlobalState>);
        await store.dispatch(Actions.loadRolesIfNeeded(['test', 'test2']));
        expect(mock1.isDone()).toBe(false);
        expect(mock2.isDone()).toBe(false);

        fakeState = cloneDeep(fakeState);
        fakeState.entities.roles.pending = new Set();
        fakeState.entities.general.serverVersion = '4.9';
        store = configureStore(fakeState as unknown as DeepPartial<GlobalState>);
        await store.dispatch(Actions.loadRolesIfNeeded(['test', 'test2', '']));
        expect(mock1.isDone()).toBe(false);
        expect(mock2.isDone()).toBe(true);
    });

    it('editRole', async () => {
        const roleId = TestHelper.basicRoles!.system_admin.id;
        const mock = nock(Client4.getRolesRoute()).
            put('/' + roleId + '/patch', JSON.stringify({id: roleId, test: 'test'})).
            reply(200, {});

        await store.dispatch(Actions.editRole({id: roleId, test: 'test'} as Partial<Role> & {id: string}));
        expect(mock.isDone()).toBe(true);
    });
});
