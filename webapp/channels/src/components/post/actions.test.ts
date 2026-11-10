// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {loadPostsAround} from 'actions/views/channel';

import testConfigureStore from 'tests/test_store';
import {getHistory} from 'utils/browser_history';
import {ActionTypes} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import {highlightPostInChannelPopout} from './actions';

jest.mock('actions/views/channel', () => ({
    loadPostsAround: jest.fn(() => ({type: 'MOCK_LOAD_POSTS_AROUND'})),
}));

jest.mock('utils/browser_history', () => ({
    getHistory: jest.fn(),
}));

describe('highlightPostInChannelPopout', () => {
    const team = TestHelper.getTeamMock({id: 'team_id', name: 'test-team'});
    const currentUser = TestHelper.getUserMock({id: 'current_user_id', username: 'currentuser'});
    const channel = TestHelper.getChannelMock({id: 'channel_id', name: 'town-square', type: 'O'});

    const baseState = {
        entities: {
            channels: {
                currentChannelId: channel.id,
                channels: {[channel.id]: channel},
                channelsInTeam: {[team.id]: new Set([channel.id])},
                myMembers: {[channel.id]: {}},
            },
            teams: {
                currentTeamId: team.id,
                teams: {[team.id]: team},
                myMembers: {[team.id]: {}},
            },
            users: {
                currentUserId: currentUser.id,
                profiles: {[currentUser.id]: currentUser},
                statuses: {},
                profilesInChannel: {},
            },
            general: {config: {}},
            preferences: {myPreferences: {}},
            roles: {roles: {}},
        },
    };

    let mockReplace: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        mockReplace = jest.fn();
        jest.mocked(getHistory).mockReturnValue({replace: mockReplace} as any);
    });

    test('should return false if team or channel is not available', async () => {
        const store = testConfigureStore({
            entities: {
                channels: {currentChannelId: '', channels: {}, channelsInTeam: {}, myMembers: {}},
                teams: {currentTeamId: '', teams: {}, myMembers: {}},
                users: {currentUserId: '', profiles: {}},
                general: {config: {}},
                preferences: {myPreferences: {}},
                roles: {roles: {}},
            },
        });

        const result = await store.dispatch(highlightPostInChannelPopout('post_id'));
        expect(result).toEqual({data: false});
        expect(jest.mocked(loadPostsAround)).not.toHaveBeenCalled();
    });

    test('should load posts around the target post', async () => {
        const store = testConfigureStore(baseState);
        await store.dispatch(highlightPostInChannelPopout('post_123'));
        expect(jest.mocked(loadPostsAround)).toHaveBeenCalledWith('channel_id', 'post_123');
    });

    test('should dispatch RECEIVED_FOCUSED_POST and navigate to popout URL', async () => {
        const store = testConfigureStore(baseState);
        await store.dispatch(highlightPostInChannelPopout('post_123'));

        const actions = store.getActions();
        expect(actions).toContainEqual({
            type: ActionTypes.RECEIVED_FOCUSED_POST,
            data: 'post_123',
            channelId: 'channel_id',
        });

        expect(mockReplace).toHaveBeenCalledWith('/_popout/channel/test-team/channels/town-square/post_123');
    });
});
