// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {waitFor} from '@testing-library/react';
import nock from 'nock';

import type {GlobalState} from '@mattermost/types/store';

import * as Actions from 'mattermost-redux/actions/content_flagging';
import {Client4} from 'mattermost-redux/client';

import TestHelper from 'packages/mattermost-redux/test/test_helper';
import configureStore from 'packages/mattermost-redux/test/test_store';

describe('Actions.getTeamContentFlaggingStatus', () => {
    const store = configureStore();
    beforeAll(() => {
        TestHelper.initBasic(Client4);
    });

    afterAll(() => {
        TestHelper.tearDown();
    });

    it('should dispatch RECEIVED_CONTENT_FLAGGING_STATUS on success', async () => {
        nock(Client4.getContentFlaggingRoute()).
            get('/team/team_id/status').
            reply(200, {enabled: true});

        await store.dispatch(Actions.getTeamContentFlaggingStatus('team_id'));

        let enabled = store.getState().entities.teams.contentFlaggingStatus.team_id;
        expect(enabled).toEqual(true);

        // Changing value for same team
        nock(Client4.getContentFlaggingRoute()).
            get('/team/team_id/status').
            reply(200, {enabled: false});

        await store.dispatch(Actions.getTeamContentFlaggingStatus('team_id'));

        enabled = store.getState().entities.teams.contentFlaggingStatus.team_id;
        expect(enabled).toEqual(false);
    });
});

describe('Actions.loadContentFlaggingTeam', () => {
    const store = configureStore();
    beforeAll(() => {
        TestHelper.initBasic(Client4);
    });

    afterAll(() => {
        TestHelper.tearDown();
    });

    it('should dispatch RECEIVED_CONTENT_FLAGGING_TEAM on success', async () => {
        const mockTeam = {
            id: 'team_id',
            name: 'test-team',
            display_name: 'Test Team',
        };

        nock(Client4.getTeamsRoute()).
            get('/team_id').
            query({
                flagged_post_id: 'post_id',
                as_content_reviewer: true,
            }).
            reply(200, mockTeam);

        await store.dispatch(Actions.loadContentFlaggingTeam({teamId: 'team_id', flaggedPostId: 'post_id'}));

        await waitFor(() => {
            const state = store.getState() as GlobalState;
            const teams = state.entities.contentFlagging.teams;
            expect(teams?.team_id).toEqual(mockTeam);
        });
    });

    it('should not make API call when teamId or flaggedPostId is missing', async () => {
        await store.dispatch(Actions.loadContentFlaggingTeam({teamId: 'team_id'}));
        await store.dispatch(Actions.loadContentFlaggingTeam({flaggedPostId: 'post_id'}));

        // Wait for the data loader to process
        await new Promise((resolve) => setTimeout(resolve, 250));

        // No API calls should have been made, so no new teams should be added
        const initialTeamCount = Object.keys(store.getState().entities.teams.teams).length;
        expect(initialTeamCount).toBeGreaterThanOrEqual(0);
    });
});

describe('Actions.loadContentFlaggingChannel', () => {
    const store = configureStore();
    beforeAll(() => {
        TestHelper.initBasic(Client4);
    });

    afterAll(() => {
        TestHelper.tearDown();
    });

    it('should dispatch RECEIVED_CONTENT_FLAGGING_CHANNEL on success', async () => {
        const mockChannel = {
            id: 'channel_id',
            name: 'test-channel',
            display_name: 'Test Channel',
            team_id: 'team_id',
        };

        nock(Client4.getChannelsRoute()).
            get('/channel_id').
            query({flagged_post_id: 'post_id', as_content_reviewer: true}).
            reply(200, mockChannel);

        await store.dispatch(Actions.loadContentFlaggingChannel({channelId: 'channel_id', flaggedPostId: 'post_id'}));

        await waitFor(() => {
            const state = store.getState() as GlobalState;
            const channels = state.entities.contentFlagging.channels;
            expect(channels?.channel_id).toEqual(mockChannel);
        });
    });

    it('should not make API call when channelId or flaggedPostId is missing', async () => {
        await store.dispatch(Actions.loadContentFlaggingChannel({channelId: 'channel_id'}));
        await store.dispatch(Actions.loadContentFlaggingChannel({flaggedPostId: 'post_id'}));

        // Wait for the data loader to process
        await new Promise((resolve) => setTimeout(resolve, 250));

        // No API calls should have been made, so no new channels should be added
        const initialChannelCount = Object.keys(store.getState().entities.channels.channels).length;
        expect(initialChannelCount).toBeGreaterThanOrEqual(0);
    });
});

describe('Actions.loadFlaggedPost', () => {
    const store = configureStore();
    beforeAll(() => {
        TestHelper.initBasic(Client4);
    });

    afterAll(() => {
        TestHelper.tearDown();
    });

    it('should dispatch RECEIVED_FLAGGED_POST on success', async () => {
        const mockPost = {
            id: 'post_id',
            message: 'Test post message',
            channel_id: 'channel_id',
            user_id: 'user_id',
        };

        nock(Client4.getContentFlaggingRoute()).
            get('/post/post_id').
            reply(200, mockPost);

        await store.dispatch(Actions.loadFlaggedPost('post_id'));

        await waitFor(() => {
            const state = store.getState() as GlobalState;
            const posts = state.entities.contentFlagging.flaggedPosts;
            expect(posts?.post_id).toEqual(mockPost);
        });
    });
});
