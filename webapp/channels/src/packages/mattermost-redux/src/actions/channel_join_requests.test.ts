// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';

import * as Actions from 'mattermost-redux/actions/channel_join_requests';
import {Client4} from 'mattermost-redux/client';

import TestHelper from 'packages/mattermost-redux/test/test_helper';
import configureStore from 'packages/mattermost-redux/test/test_store';

describe('actions/channel_join_requests', () => {
    beforeAll(() => {
        TestHelper.initBasic(Client4);
    });

    afterAll(() => {
        TestHelper.tearDown();
    });

    test('requestJoinChannel stores the pending request on success', async () => {
        const store = configureStore();
        const req = {
            id: 'req1',
            channel_id: 'channel1',
            user_id: 'user1',
            message: '',
            status: 'pending',
            denial_reason: '',
            create_at: 1,
            update_at: 1,
            reviewed_by: '',
            reviewed_at: 0,
        };

        nock(Client4.getBaseRoute()).
            post('/channels/channel1/join_request').
            reply(201, req);

        const result = await store.dispatch(Actions.requestJoinChannel('channel1'));
        expect(result.error).toBeUndefined();
        expect(store.getState().entities.channelJoinRequests.pendingByMe.channel1).toEqual(req);
    });

    test('requestJoinChannel clears pendingByMe on ABAC fast-path approval', async () => {
        const store = configureStore();

        nock(Client4.getBaseRoute()).
            post('/channels/channel2/join_request').
            reply(201, {status: 'approved'});

        const result = await store.dispatch(Actions.requestJoinChannel('channel2'));
        expect(result.error).toBeUndefined();
        expect(store.getState().entities.channelJoinRequests.pendingByMe.channel2).toBeNull();
    });

    test('withdrawChannelJoinRequest clears the slot and stores the withdrawn row', async () => {
        const store = configureStore();
        const withdrawn = {
            id: 'req1',
            channel_id: 'channel1',
            user_id: 'user1',
            message: '',
            status: 'withdrawn',
            denial_reason: '',
            create_at: 1,
            update_at: 2,
            reviewed_by: 'user1',
            reviewed_at: 2,
        };

        nock(Client4.getBaseRoute()).
            delete('/channels/channel1/join_request').
            reply(200, withdrawn);

        const result = await store.dispatch(Actions.withdrawChannelJoinRequest('channel1'));
        expect(result.error).toBeUndefined();
        expect(store.getState().entities.channelJoinRequests.pendingByMe.channel1).toBeNull();
    });

    test('getMyChannelJoinRequest treats 404 as no pending request', async () => {
        const store = configureStore();

        nock(Client4.getBaseRoute()).
            get('/channels/channel3/join_request').
            reply(404, {
                id: 'app.channel.join_request.not_found.app_error',
                message: 'No pending join request',
                status_code: 404,
            });

        const result = await store.dispatch(Actions.getMyChannelJoinRequest('channel3'));
        expect(result.error).toBeUndefined();
        expect(result.data).toBeNull();
        expect(store.getState().entities.channelJoinRequests.pendingByMe.channel3).toBeNull();
    });
});
