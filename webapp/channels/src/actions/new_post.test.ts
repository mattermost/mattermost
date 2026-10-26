// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';
import type {GlobalState} from '@mattermost/types/store';

import {ChannelTypes} from 'mattermost-redux/action_types';
import {receivedNewPost} from 'mattermost-redux/actions/posts';
import {Posts} from 'mattermost-redux/constants';

import * as NewPostActions from 'actions/new_post';
import realConfigureStore from 'store';

import mockStore from 'tests/test_store';
import {Constants} from 'utils/constants';
import * as NotificationSounds from 'utils/notification_sounds';
import * as NotificationUtils from 'utils/notifications';

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
                profiles: {
                    current_user_id: {},
                },
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
        const websocketProps: NewPostActions.NewPostMessageProps = {
            team_id: 'team_id',
            mentions: JSON.stringify(['current_user_id']),
            should_ack: false,
            channel_display_name: '',
            channel_name: '',
            channel_type: 'P',
            post: JSON.stringify(newPost),
            sender_name: '',
            set_online: false,
        };

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

            const actions = NewPostActions.setChannelReadAndViewed(testStore.dispatch, testStore.getState, post2, newPostMessageProps, false);

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

    // A post created with deferred notifications is first broadcast silent, then broadcast
    // again under the same id once its notifications are released.
    describe('posted event repeated for a post the client already has', () => {
        const channelId = 'deferred_channel_id';
        const teamId = 'team_id';
        const currentUserId = 'current_user_id';
        const botUserId = 'bot_user_id';
        const rootId = 'root_post_id';
        const postId = 'deferred_post_id';

        let showNotification: jest.SpyInstance;

        beforeEach(() => {
            showNotification = jest.spyOn(NotificationUtils, 'showNotification').mockReturnValue((async () => ({status: 'success'})) as unknown as ReturnType<typeof NotificationUtils.showNotification>);
            (NotificationSounds as {ding: typeof NotificationSounds.ding}).ding = jest.fn();
        });

        afterEach(() => {
            showNotification.mockRestore();
        });

        function makeStore(collapsedThreads: boolean) {
            const rootPost = {id: rootId, channel_id: channelId, user_id: currentUserId, root_id: '', create_at: 1000, update_at: 1000, message: 'question', props: {}, reply_count: 1};

            return realConfigureStore({
                entities: {
                    general: {
                        config: {CollapsedThreads: collapsedThreads ? 'always_on' : 'disabled'},
                    },
                    users: {
                        currentUserId,
                        profiles: {
                            [currentUserId]: {id: currentUserId, username: 'me', notify_props: {desktop: 'mention', desktop_threads: 'all', channel: 'true', first_name: 'false', mention_keys: ''}},
                            [botUserId]: {id: botUserId, username: 'agent', is_bot: true},
                        },
                        statuses: {[currentUserId]: 'online'},
                    },
                    teams: {
                        currentTeamId: teamId,
                        teams: {[teamId]: {id: teamId, name: 'team'}},
                        myMembers: {[teamId]: {team_id: teamId, user_id: currentUserId, msg_count: 0, msg_count_root: 0, mention_count: 0, mention_count_root: 0}},
                    },
                    channels: {
                        currentChannelId: 'other_channel_id',
                        channels: {
                            [channelId]: {id: channelId, team_id: teamId, type: 'O', name: 'town', display_name: 'Town', last_post_at: 1000, last_root_post_at: 1000},
                            other_channel_id: {id: 'other_channel_id', team_id: teamId, type: 'O', name: 'other', display_name: 'Other'},
                        },
                        myMembers: {
                            [channelId]: {channel_id: channelId, user_id: currentUserId, msg_count: 1, msg_count_root: 1, mention_count: 0, mention_count_root: 0, urgent_mention_count: 0, last_viewed_at: 1000, notify_props: {desktop: 'default', mark_unread: 'all'}},
                        },
                        messageCounts: {[channelId]: {total: 1, root: 1}},
                        manuallyUnread: {},
                    },
                    posts: {
                        posts: {[rootId]: rootPost},
                        postsInChannel: {[channelId]: [{order: [rootId], recent: true}]},
                        postsInThread: {},
                    },
                    threads: {
                        threads: collapsedThreads ? {[rootId]: {id: rootId, reply_count: 1, last_reply_at: 1000, participants: [{id: currentUserId}], is_following: true, unread_replies: 0, unread_mentions: 0, post: {channel_id: channelId, user_id: currentUserId}}} : {},
                    },
                    preferences: {myPreferences: {}},
                },
                views: {
                    browser: {focused: false},
                },
            } as unknown as Parameters<typeof realConfigureStore>[0]);
        }

        function postedEvents(post: Post) {
            const placeholder = {
                ...post,
                message: 'thinking...',
                props: {from_bot: 'true', deferred_notification: true, silent_notification: true},
            } as unknown as Post;
            const released = {
                ...post,
                update_at: post.update_at + 1000,
                message: 'the final answer',
                props: {from_bot: 'true'},
            } as unknown as Post;
            const messageProps = {team_id: teamId, channel_type: 'O', channel_display_name: 'Town', channel_name: 'town', sender_name: 'agent', set_online: false} as NewPostActions.NewPostMessageProps;

            return {
                placeholder: {post: placeholder, props: {...messageProps, post: JSON.stringify(placeholder)}},
                released: {post: released, props: {...messageProps, post: JSON.stringify(released), mentions: JSON.stringify([currentUserId]), ...(post.root_id ? {followers: JSON.stringify([currentUserId])} : {})}},
            };
        }

        test('channel post is updated in place and counted as unread once', async () => {
            const store = makeStore(false);
            const {placeholder, released} = postedEvents({id: postId, channel_id: channelId, user_id: botUserId, root_id: '', create_at: 2000, update_at: 2000, reply_count: 0} as Post);

            await store.dispatch(NewPostActions.completePostReceive(placeholder.post, placeholder.props));

            let state = store.getState();
            expect(state.entities.posts.postsInChannel[channelId][0].order).toEqual([postId, rootId]);
            expect(state.entities.channels.messageCounts[channelId].total).toBe(1);
            expect(state.entities.channels.myMembers[channelId].mention_count).toBe(0);
            expect(showNotification).not.toHaveBeenCalled();

            await store.dispatch(NewPostActions.completePostReceive(released.post, released.props));

            state = store.getState();
            expect(state.entities.posts.postsInChannel[channelId][0].order).toEqual([postId, rootId]);
            expect(state.entities.posts.posts[postId].message).toBe('the final answer');
            expect(state.entities.posts.posts[postId].props).not.toHaveProperty('silent_notification');
            expect(state.entities.channels.messageCounts[channelId]).toEqual({total: 2, root: 2});
            expect(state.entities.channels.myMembers[channelId].mention_count).toBe(1);
            expect(state.entities.teams.myMembers[teamId].mention_count).toBe(1);
            expect(showNotification).toHaveBeenCalledTimes(1);
            expect(showNotification).toHaveBeenCalledWith(expect.objectContaining({body: '@agent: the final answer', tag: postId}));
        });

        test('collapsed threads reply is not duplicated and does not change the reply count', async () => {
            const store = makeStore(true);
            const {placeholder, released} = postedEvents({id: postId, channel_id: channelId, user_id: botUserId, root_id: rootId, create_at: 2000, update_at: 2000, reply_count: 1} as Post);

            await store.dispatch(NewPostActions.completePostReceive(placeholder.post, placeholder.props));
            await store.dispatch(NewPostActions.completePostReceive(released.post, released.props));

            const state = store.getState();
            expect(state.entities.posts.postsInThread[rootId]).toEqual([postId]);
            expect(state.entities.posts.postsInChannel[channelId][0].order).toEqual([rootId]);
            expect(state.entities.posts.posts[postId].message).toBe('the final answer');
            expect(state.entities.posts.posts[rootId].reply_count).toBe(1);
            expect(state.entities.threads.threads[rootId].reply_count).toBe(1);
            expect(state.entities.channels.myMembers[channelId].mention_count).toBe(1);
            expect(showNotification).toHaveBeenCalledTimes(1);
            expect(showNotification).toHaveBeenCalledWith(expect.objectContaining({body: '@agent: the final answer', tag: postId}));
        });
    });
});
