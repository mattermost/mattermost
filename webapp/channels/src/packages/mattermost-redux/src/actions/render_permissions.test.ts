// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';

import * as Actions from 'mattermost-redux/actions/render_permissions';
import {Client4} from 'mattermost-redux/client';

import TestHelper from '../../test/test_helper';
import configureStore from '../../test/test_store';

describe('Actions.RenderPermissions delegated permissions', () => {
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

    it('stores the union of the permissions of every allowed action', async () => {
        nock(Client4.getBaseRoute()).
            get('/access_control/decisions/actions/admin').
            reply(200, {
                resource: {type: 'system'},
                results: [
                    {name: 'run_compliance_export', permissions: ['create_compliance_export_job', 'read_compliance_export_job']},
                    {name: 'run_other_export', permissions: ['read_compliance_export_job', 'download_compliance_export_result']},
                ],
            });

        await store.dispatch(Actions.fetchDelegatedPermissions());

        const delegated = store.getState().entities.renderPermissions.delegatedPermissions;
        expect(delegated.loaded).toBe(true);
        expect(delegated.permissions).toEqual(['create_compliance_export_job', 'read_compliance_export_job', 'download_compliance_export_result']);
    });

    it('fails closed to an empty set on an error', async () => {
        nock(Client4.getBaseRoute()).
            get('/access_control/decisions/actions/admin').
            reply(200, {resource: {type: 'system'}, results: [{name: 'run_compliance_export', permissions: ['create_compliance_export_job']}]});
        await store.dispatch(Actions.fetchDelegatedPermissions());

        nock(Client4.getBaseRoute()).
            get('/access_control/decisions/actions/admin').
            reply(500, {message: 'internal error'});
        const result = await store.dispatch(Actions.fetchDelegatedPermissions());

        expect(result.error).toBeTruthy();
        const delegated = store.getState().entities.renderPermissions.delegatedPermissions;
        expect(delegated.loaded).toBe(true);
        expect(delegated.permissions).toEqual([]);
    });

    it('an invalidation marks the set stale', async () => {
        nock(Client4.getBaseRoute()).
            get('/access_control/decisions/actions/admin').
            reply(200, {resource: {type: 'system'}, results: []});
        await store.dispatch(Actions.fetchDelegatedPermissions());

        store.dispatch(Actions.invalidateDelegatedPermissions());

        expect(store.getState().entities.renderPermissions.delegatedPermissions.loaded).toBe(false);
    });
});
