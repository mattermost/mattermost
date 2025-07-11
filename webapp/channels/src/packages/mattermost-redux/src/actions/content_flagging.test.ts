// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';

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
