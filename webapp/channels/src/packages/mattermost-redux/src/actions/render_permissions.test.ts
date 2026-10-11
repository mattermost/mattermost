// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';

import {fetchSessionRenderDecisions} from 'mattermost-redux/actions/render_permissions';
import {Client4} from 'mattermost-redux/client';

import TestHelper from '../../test/test_helper';
import configureStore from '../../test/test_store';

describe('Actions.RenderPermissions', () => {
    beforeAll(() => {
        TestHelper.initBasic(Client4);
    });

    afterAll(() => {
        TestHelper.tearDown();
    });

    describe('fetchSessionRenderDecisions', () => {
        it('should ask for the DM/GM actions on the system resource and store the decisions', async () => {
            const store = configureStore();

            let body;
            nock(Client4.getBaseRoute()).
                post('/access_control/decisions/actions/search', (requestBody) => {
                    body = requestBody;
                    return true;
                }).
                reply(200, {
                    resource: {type: 'permission', id: ''},
                    results: [],
                    decisions: {
                        dm_gm_start: {allowed: true, evaluated: true},
                        dm_gm_read_access: {allowed: false, evaluated: true},
                        dm_gm_write_access: {allowed: true, evaluated: true},
                    },
                });

            const result = await store.dispatch(fetchSessionRenderDecisions());

            expect(result.error).toBeUndefined();
            expect(body).toEqual({
                resource: {type: 'permission', id: ''},
                actions: ['dm_gm_start', 'dm_gm_read_access', 'dm_gm_write_access'],
            });

            const decisions = store.getState().entities.renderPermissions.byResource.permission[''];
            expect(Object.keys(decisions)).toHaveLength(3);
            expect(decisions.dm_gm_read_access).toMatchObject({allowed: false, evaluated: true});
            expect(decisions.dm_gm_start).toMatchObject({allowed: true, evaluated: true});
        });

        it('should keep the last known decision when the server reports an evaluation error', async () => {
            const store = configureStore({
                entities: {
                    renderPermissions: {
                        byResource: {permission: {'': {dm_gm_write_access: {allowed: false, evaluated: true, generation: 0}}}},
                        invalidatedAt: 0,
                        invalidatedAtByResource: {},
                    },
                },
            });

            nock(Client4.getBaseRoute()).
                post('/access_control/decisions/actions/search').
                reply(200, {
                    resource: {type: 'permission', id: ''},
                    results: [],
                    decisions: {
                        dm_gm_start: {allowed: false, evaluated: true, reason: 'restricted_by_policy'},
                        dm_gm_read_access: {allowed: true, evaluated: true},
                        dm_gm_write_access: {allowed: false, evaluated: true, reason: 'restricted_by_policy'},
                    },
                });

            await store.dispatch(fetchSessionRenderDecisions());

            const decisions = store.getState().entities.renderPermissions.byResource.permission[''];
            expect(decisions.dm_gm_start).toBeUndefined();
            expect(decisions.dm_gm_write_access).toEqual({allowed: false, evaluated: true, generation: 0});
            expect(decisions.dm_gm_read_access).toMatchObject({allowed: true, evaluated: true});
        });

        it('should change nothing when the server rejects the permission resource', async () => {
            const store = configureStore();

            nock(Client4.getBaseRoute()).
                post('/access_control/decisions/actions/search').
                reply(400, {message: 'Invalid resource type', status_code: 400});

            const result = await store.dispatch(fetchSessionRenderDecisions());

            expect(result.error).toBeDefined();
            expect(store.getState().entities.renderPermissions.byResource).toEqual({});
        });
    });
});
