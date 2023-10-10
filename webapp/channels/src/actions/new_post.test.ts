// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';
import type {GlobalState} from '@mattermost/types/store';

import {ChannelTypes} from 'mattermost-redux/action_types';
import {receivedNewPost} from 'mattermost-redux/actions/posts';
import {Posts} from 'mattermost-redux/constants';
import type {GetStateFunc} from 'mattermost-redux/types/actions';

import * as NewPostActions from 'actions/new_post';

import mockStore from 'tests/test_store';
import {Constants} from 'utils/constants';

jest.mock('mattermost-redux/actions/channels', () => ({
    ...jest.requireActual('mattermost-redux/actions/channels'),
    markChannelAsReadOnServer: (...args: any[]) => ({type: 'MOCK_MARK_CHANNEL_AS_READ_ON_SERVER', args}),
    markChannelAsViewedOnServer: (...args: any[]) => ({type: 'MOCK_MARK_CHANNEL_AS_VIEWED_ON_SERVER', args}),
}));

const POST_CREATED_TIME = Date.now();

// This mocks the Date.now() function so it returns a constant value
global.Date.now = jest.fn(() => POST_CREATED_TIME);

const newPostMessageProps = {} as NewPostActions.NewPostMessageProps;

const INCREASED_POST_VISIBILITY = {amount: 1, data: 'current_channel_id', type: 'INCREASE_POST_VISIBILITY'};

describe('actions/new_post', () => {
    const latestPost = {
        id: 'latest_post_id',
        user_id: 'current_user_id',
        message: 'test msg',
        channel_id: 'current_channel_id',
    };
    const initialState = {
        entities: {
            posts: {
                posts: {
                    [latestPost.id]: latestPost,
                },
                postsInChannel: {
                    current_channel_id: [
                        {order: [latestPost.id], recent: true},
                    ],
                },
                postsInThread: {},
                messagesHistory: {
                    index: {
                        [Posts.MESSAGE_TYPES.COMMENT]: 0,
                    },
                    messages: ['test message'],
                },
            },
            channels: {
                currentChannelId: 'current_channel_id',
                messageCounts: {},
                myMembers: {[latestPost.channel_id]: {channel_id: 'current_channel_id', user_id: 'current_user_id'}},
                channels: {
                    current_channel_id: {id: 'current_channel_id'},
                },
            },
            teams: {
                currentTeamId: 'team-1',
                teams: {
                    team_id: {
                        id: 'team_id',
                        name: 'team-1',
                        displayName: 'Team 1',
                    },
                },
            },
            users: {
                currentUserId: 'current_user_id',
            },
            general: {
                license: {IsLicensed: 'false'},
                config: {
                    TeammateNameDisplay: 'username',
                },
            },
            preferences: {
                myPreferences: {},
            },
        },
        views: {
            posts: {
                editingPost: {},
            },
        },
    } as unknown as GlobalState;

    test('completePostReceive', async () => {
        const testStore = mockStore(initialState);
        const newPost = {id: 'new_post_id', channel_id: 'current_channel_id', message: 'new message', type: Constants.PostTypes.ADD_TO_CHANNEL, user_id: 'some_user_id', create_at: POST_CREATED_TIME, props: {addedUserId: 'other_user_id'}} as unknown as Post;
        const websocketProps = {team_id: 'team_id', mentions: ['current_user_id']};

        await testStore.dispatch(NewPostActions.completePostReceive(newPost, websocketProps));
        expect(testStore.getActions()).toEqual([
            {
                meta: {batch: true},
                payload: [
                    INCREASED_POST_VISIBILITY,
                    receivedNewPost(newPost, false),
                ],
                type: 'BATCHING_REDUCER.BATCH',
            },
        ]);
    });

    describe('setChannelReadAndViewed', () => {
        test('should mark channel as read when viewing channel', () => {
            const channelId = 'channel';
            const currentUserId = 'user';

            const post1 = {id: 'post1', channel_id: channelId, create_at: 1000} as Post;
            const post2 = {id: 'post2', channel_id: channelId, create_at: 2000} as Post;

            const testStore = mockStore({
                entities: {
                    channels: {
                        currentChannelId: channelId,
                        manuallyUnread: {},
                        messageCounts: {
                            [channelId]: {total: 0},
                        },
                        myMembers: {
                            [channelId]: {channel_id: channelId, last_viewed_at: 0, roles: ''},
                        },
                        channels: {
                            [channelId]: {id: channelId},
                        },
                    },
                    posts: {
                        posts: {
                            [post1.id]: post1,
                        },
                    },
                    users: {
                        currentUserId,
                    },
                    general: {
                        config: {
                            test: true,
                        },
                    },
                    preferences: {
                        myPreferences: {},
                    },
                },
            } as unknown as GlobalState);

            window.isActive = true;

            const actions = NewPostActions.setChannelReadAndViewed(testStore.dispatch, testStore.getState as GetStateFunc, post2, newPostMessageProps, false);

            expect(actions).toMatchObject([
                {
                    type: ChannelTypes.DECREMENT_UNREAD_MSG_COUNT,
                    data: {
                        channelId,
                    },
                },
                {
                    type: ChannelTypes.DECREMENT_UNREAD_MENTION_COUNT,
                    data: {
                        channelId,
                    },
                },
                {
                    type: ChannelTypes.RECEIVED_LAST_VIEWED_AT,
                    data: {
                        channel_id: channelId,
                    },
                },
            ]);
            expect(testStore.getActions()).toMatchObject([
                {
                    type: 'MOCK_MARK_CHANNEL_AS_VIEWED_ON_SERVER',
                    args: [channelId],
                },
            ]);
        });

        test('should mark channel as unread when not actively viewing channel', () => {
            const channelId = 'channel';
            const currentUserId = 'user';

            const post1 = {id: 'post1', channel_id: channelId, create_at: 1000} as Post;
            const post2 = {id: 'post2', channel_id: channelId, create_at: 2000} as Post;

            const testStore = mockStore({
                entities: {
                    channels: {
                        currentChannelId: channelId,
                        manuallyUnread: {},
                        messageCounts: {
                            [channelId]: {total: 0},
                        },
                        myMembers: {
                            [channelId]: {channel_id: channelId, last_viewed_at: 0, roles: ''},
                        },
                        channels: {
                            [channelId]: {id: channelId},
                        },
                    },
                    posts: {
                        posts: {
                            [post1.id]: post1,
                        },
                    },
                    users: {
                        currentUserId,
                    },
                    general: {
                        config: {
                            test: true,
                        },
                    },
                    preferences: {
                        myPreferences: {},
                    },
                },
            } as unknown as GlobalState);

            window.isActive = false;

            const actions = NewPostActions.setChannelReadAndViewed(testStore.dispatch, testStore.getState, post2, newPostMessageProps, false);

            expect(actions).toMatchObject([
                {
                    type: ChannelTypes.INCREMENT_UNREAD_MSG_COUNT,
                    data: {
                        channelId,
                    },
                },
                {
                    type: ChannelTypes.INCREMENT_TOTAL_MSG_COUNT,
                    data: {
                        channelId,
                    },
                },
            ]);
            expect(testStore.getActions()).toEqual([]);
        });

        test('should not mark channel as read when not viewing channel', () => {
            const channelId = 'channel1';
            const otherChannelId = 'channel2';
            const currentUserId = 'user';

            const post1 = {id: 'post1', channel_id: channelId, create_at: 1000} as Post;
            const post2 = {id: 'post2', channel_id: channelId, create_at: 2000} as Post;

            const testStore = mockStore({
                entities: {
                    channels: {
                        currentChannelId: otherChannelId,
                        manuallyUnread: {},
                        messageCounts: {
                            [channelId]: {total: 0},
                            [otherChannelId]: {total: 0},
                        },
                        myMembers: {
                            [channelId]: {channel_id: channelId, last_viewed_at: 500, roles: ''},
                            [otherChannelId]: {channel_id: otherChannelId, last_viewed_at: 500, roles: ''},
                        },
                        channels: {
                            [channelId]: {id: channelId},
                            [otherChannelId]: {id: otherChannelId},
                        },
                    },
                    posts: {
                        posts: {
                            [post1.id]: post1,
                        },
                    },
                    users: {
                        currentUserId,
                    },
                    general: {
                        config: {
                            test: true,
                        },
                    },
                    preferences: {
                        myPreferences: {},
                    },
                },
            } as unknown as GlobalState);

            window.isActive = true;

            const actions = NewPostActions.setChannelReadAndViewed(testStore.dispatch, testStore.getState, post2, newPostMessageProps, false);

            expect(actions).toMatchObject([
                {
                    type: ChannelTypes.INCREMENT_UNREAD_MSG_COUNT,
                    data: {
                        channelId,
                    },
                },
                {
                    type: ChannelTypes.INCREMENT_TOTAL_MSG_COUNT,
                    data: {
                        channelId,
                    },
                },
            ]);
            expect(testStore.getActions()).toEqual([]);
        });

        test('should mark channel as read when not viewing channel and post is from current user', () => {
            const channelId = 'channel1';
            const otherChannelId = 'channel2';
            const currentUserId = 'user';

            const post1 = {id: 'post1', channel_id: channelId, create_at: 1000} as Post;
            const post2 = {id: 'post2', channel_id: channelId, create_at: 2000, user_id: currentUserId} as Post;

            const testStore = mockStore({
                entities: {
                    channels: {
                        currentChannelId: otherChannelId,
                        manuallyUnread: {},
                        messageCounts: {
                            [channelId]: {total: 0},
                            [otherChannelId]: {total: 0},
                        },
                        myMembers: {
                            [channelId]: {channel_id: channelId, last_viewed_at: 500, roles: ''},
                            [otherChannelId]: {channel_id: otherChannelId, last_viewed_at: 500, roles: ''},
                        },
                        channels: {
                            [channelId]: {id: channelId},
                            [otherChannelId]: {id: otherChannelId},
                        },
                    },
                    posts: {
                        posts: {
                            [post1.id]: post1,
                        },
                    },
                    users: {
                        currentUserId,
                    },
                    general: {
                        config: {
                            test: true,
                        },
                    },
                    preferences: {
                        myPreferences: {},
                    },
                },
            } as unknown as GlobalState);

            const actions = NewPostActions.setChannelReadAndViewed(testStore.dispatch, testStore.getState, post2, {} as NewPostActions.NewPostMessageProps, false);

            expect(actions).toMatchObject([
                {
                    type: ChannelTypes.DECREMENT_UNREAD_MSG_COUNT,
                    data: {
                        channelId,
                    },
                },
                {
                    type: ChannelTypes.DECREMENT_UNREAD_MENTION_COUNT,
                    data: {
                        channelId,
                    },
                },
                {
                    type: ChannelTypes.RECEIVED_LAST_VIEWED_AT,
                    data: {
                        channel_id: channelId,
                    },
                },
            ]);

            // The post is from the current user, so no request should be made to the server to mark it as read
            expect(testStore.getActions()).toEqual([]);
        });

        test('should mark channel as unread when not viewing channel and post is from webhook owned by current user', async () => {
            const channelId = 'channel1';
            const otherChannelId = 'channel2';
            const currentUserId = 'user';

            const post1 = {id: 'post1', channel_id: channelId, create_at: 1000} as Post;
            const post2 = {id: 'post2', channel_id: channelId, create_at: 2000, props: {from_webhook: 'true'}, user_id: currentUserId} as unknown as Post;

            const testStore = mockStore({
                entities: {
                    channels: {
                        currentChannelId: otherChannelId,
                        manuallyUnread: {},
                        messageCounts: {
                            [channelId]: {total: 0},
                            [otherChannelId]: {total: 0},
                        },
                        myMembers: {
                            [channelId]: {channel_id: channelId, last_viewed_at: 500, roles: ''},
                            [otherChannelId]: {channel_id: otherChannelId, last_viewed_at: 500, roles: ''},
                        },
                        channels: {
                            [channelId]: {id: channelId},
                            [otherChannelId]: {id: otherChannelId},
                        },
                    },
                    posts: {
                        posts: {
                            [post1.id]: post1,
                        },
                    },
                    users: {
                        currentUserId,
                    },
                    general: {
                        config: {
                            test: true,
                        },
                    },
                    preferences: {
                        myPreferences: {},
                    },
                },
            } as unknown as GlobalState);

            const actions = NewPostActions.setChannelReadAndViewed(testStore.dispatch, testStore.getState, post2, newPostMessageProps, false);

            expect(actions).toMatchObject([
                {
                    type: ChannelTypes.INCREMENT_UNREAD_MSG_COUNT,
                    data: {
                        channelId,
                    },
                },
                {
                    type: ChannelTypes.INCREMENT_TOTAL_MSG_COUNT,
                    data: {
                        channelId,
                    },
                },
            ]);
            expect(testStore.getActions()).toEqual([]);
        });

        test('should not mark channel as read when viewing channel that was marked as unread', () => {
            const channelId = 'channel1';
            const currentUserId = 'user';

            const post1 = {id: 'post1', channel_id: channelId, create_at: 1000} as Post;
            const post2 = {id: 'post2', channel_id: channelId, create_at: 2000} as Post;

            const testStore = mockStore({
                entities: {
                    channels: {
                        currentChannelId: channelId,
                        manuallyUnread: {
                            [channelId]: true,
                        },
                        messageCounts: {
                            [channelId]: {total: 0},
                        },
                        myMembers: {
                            [channelId]: {channel_id: channelId, last_viewed_at: post1.create_at - 1, roles: ''},
                        },
                        channels: {
                            [channelId]: {id: channelId},
                        },
                    },
                    posts: {
                        posts: {
                            [post1.id]: post1,
                        },
                    },
                    users: {
                        currentUserId,
                    },
                },
            } as unknown as GlobalState);

            const actions = NewPostActions.setChannelReadAndViewed(testStore.dispatch, testStore.getState, post2, newPostMessageProps, false);

            expect(actions).toMatchObject([
                {
                    type: ChannelTypes.INCREMENT_UNREAD_MSG_COUNT,
                    data: {
                        channelId,
                    },
                },
                {
                    type: ChannelTypes.INCREMENT_TOTAL_MSG_COUNT,
                    data: {
                        channelId,
                    },
                },
            ]);
            expect(testStore.getActions()).toEqual([]);
        });
    });
});
