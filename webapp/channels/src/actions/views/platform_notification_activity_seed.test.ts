// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from 'mattermost-redux/client';

import testConfigureStore from 'tests/test_store';
import {ActionTypes} from 'utils/constants';

import {fillPlatformNotificationActivity, seedPlatformNotificationRecords} from './platform_notification_activity';

jest.mock('mattermost-redux/actions/search', () => ({
    ...jest.requireActual('mattermost-redux/actions/search'),
    getMissingChannelsFromPosts: jest.fn(() => async () => []),
}));

jest.mock('mattermost-redux/actions/users', () => ({
    ...jest.requireActual('mattermost-redux/actions/users'),
    getMissingProfilesByIds: jest.fn(() => async () => ({data: []})),
}));

const mentionPost = {
    id: 'mention_post',
    user_id: 'jordan',
    root_id: '',
    channel_id: 'town-square',
    message: '@asaad can you review this?',
    create_at: 1700000000000,
    props: {},
};

function makeState() {
    return {
        entities: {
            users: {
                currentUserId: 'asaad',
                profiles: {
                    asaad: {
                        id: 'asaad',
                        username: 'asaad',
                        notify_props: {desktop: 'mention'},
                    },
                    jordan: {
                        id: 'jordan',
                        username: 'jordan',
                    },
                },
            },
            teams: {
                currentTeamId: 'team1',
                teams: {
                    team1: {id: 'team1', name: 'mattermost', delete_at: 0},
                },
                myMembers: {
                    team1: {team_id: 'team1'},
                },
            },
            channels: {
                channels: {
                    'town-square': {
                        id: 'town-square',
                        team_id: 'team1',
                        display_name: 'Town Square',
                        name: 'town-square',
                        type: 'O',
                        delete_at: 0,
                    },
                },
                myMembers: {},
                membersInChannel: {},
                messageCounts: {},
                channelsInTeam: {team1: new Set(['town-square'])},
            },
            posts: {
                posts: {},
            },
            preferences: {
                myPreferences: {},
            },
            general: {
                config: {},
            },
        },
        views: {
            rhs: {
                platformNotifications: [],
            },
        },
    };
}

describe('seedPlatformNotificationRecords', () => {
    beforeEach(() => {
        jest.spyOn(Client4, 'searchPostsWithParams').mockResolvedValue({
            order: [mentionPost.id],
            posts: {[mentionPost.id]: mentionPost},
            next_post_id: '',
            prev_post_id: '',
            first_inaccessible_post_time: 0,
        } as any);
        jest.spyOn(Client4, 'getUserThreads').mockResolvedValue({
            total: 0,
            total_unread_threads: 0,
            total_unread_mentions: 0,
            threads: [],
        } as any);
        jest.spyOn(Client4, 'getPosts').mockResolvedValue({
            order: [],
            posts: {},
            next_post_id: '',
            prev_post_id: '',
            first_inaccessible_post_time: 0,
        } as any);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('turns existing mentions into Activity records', async () => {
        const store = testConfigureStore(makeState());

        const result = await store.dispatch(seedPlatformNotificationRecords());

        expect(result.data).toEqual([
            expect.objectContaining({
                postId: 'mention_post',
                channelId: 'town-square',
                isMention: true,
                isThreadReply: false,
            }),
        ]);
    });

    test('fills an empty Activity list from mentions', async () => {
        const store = testConfigureStore(makeState());

        const result = await store.dispatch(fillPlatformNotificationActivity());

        expect(result).toEqual({data: true});
        expect(store.getActions()).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: ActionTypes.HYDRATE_PLATFORM_NOTIFICATIONS,
                data: [expect.objectContaining({postId: 'mention_post', isMention: true})],
            }),
        ]));
    });
});
