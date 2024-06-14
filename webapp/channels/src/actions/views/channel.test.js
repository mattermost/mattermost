// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';

import {markChannelAsRead, getChannel} from 'mattermost-redux/actions/channels';
import * as PostActions from 'mattermost-redux/actions/posts';
import * as UserActions from 'mattermost-redux/actions/users';
import {Client4} from 'mattermost-redux/client';
import {General, Posts, RequestStatus} from 'mattermost-redux/constants';

import * as Actions from 'actions/views/channel';
import configureStore from 'store';

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import mockStore from 'tests/test_store';
import {getHistory} from 'utils/browser_history';
import {ActionTypes, PostRequestTypes} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

jest.mock('utils/channel_utils.tsx', () => {
    const original = jest.requireActual('utils/channel_utils.tsx');

    return {
        ...original,
        getRedirectChannelNameForTeam: () => 'town-square',
    };
});

jest.mock('mattermost-redux/actions/users');

jest.mock('mattermost-redux/actions/channels', () => ({
    ...jest.requireActual('mattermost-redux/actions/channels'),
    markChannelAsRead: jest.fn(() => ({type: ''})),
    getChannel: jest.fn(() => ({
        type: 'RECEIVED_CHANNEL',
        data: {team_id: 'teamid1', id: 'non-existing-channelid', name: 'non-existing-channel', display_name: 'Channel 1', type: 'O'},
    })),
}));

jest.mock('mattermost-redux/actions/posts');

jest.mock('selectors/local_storage', () => ({
    getLastViewedChannelName: () => 'channel1',
}));

jest.mock('mattermost-redux/selectors/entities/utils', () => ({
    makeAddLastViewAtToProfiles: () => jest.fn().mockReturnValue([]),
}));

Client4.setUrl('http://localhost:8065');

describe('channel view actions', () => {
    const channel1 = {id: 'channelid1', name: 'channel1', display_name: 'Channel 1', type: 'O', team_id: 'teamid1'};
    const townsquare = {id: 'channelid2', name: General.DEFAULT_CHANNEL, display_name: 'Town Square', type: 'O', team_id: 'teamid1'};
    const gmChannel = {id: 'gmchannelid', name: 'gmchannel', display_name: 'GM Channel 1', type: 'G'};
    const team1 = {id: 'teamid1', name: 'team1'};

    const initialState = {
        entities: {
            users: {
                currentUserId: 'userid1',
                profiles: {userid1: {id: 'userid1', username: 'username1', roles: 'system_user'}, userid2: {id: 'userid2', username: 'username2', roles: 'system_user'}},
                profilesInChannel: {},
            },
            teams: {
                currentTeamId: 'teamid1',
                myMembers: {teamId1: {}},
                teams: {teamid1: team1},
            },
            channels: {
                currentChannelId: 'channelid1',
                channels: {channelid1: channel1, channelid2: townsquare, gmchannelid: gmChannel},
                manuallyUnread: {},
                myMembers: {
                    gmchannelid: {channel_id: 'gmchannelid', user_id: 'userid1'},
                    channelid1: {channel_id: 'channelid1', user_id: 'userid1'},
                    townsquare: {channel_id: 'townsquare', user_id: 'userid1'},
                },
                channelsInTeam: {
                    [team1.id]: [channel1.id, townsquare.id],
                },
            },
            general: {
                config: {},
                serverVersion: '5.12.0',
            },
            roles: {
                roles: {
                    system_user: {permissions: ['join_public_channels']},
                },
            },
            preferences: {
                myPreferences: {},
            },
            posts: {
                postsInChannel: {},
                posts: {},
            },
            channelCategories: {
                byId: {},
            },
        },
        views: {
            channel: {
                loadingPosts: {},
                postVisibility: {current_channel_id: 60},
            },
            rhs: {
                selectedPostId: '',
            },
        },
    };

    let store;

    beforeEach(() => {
        store = mockStore(initialState);
    });

    describe('switchToChannel', () => {
        test('switch to public channel', () => {
            store.dispatch(Actions.switchToChannel(channel1));
            expect(getHistory().push).toHaveBeenCalledWith(`/${team1.name}/channels/${channel1.name}`);
        });

        test('switch to gm channel', async () => {
            await store.dispatch(Actions.switchToChannel(gmChannel));
            expect(getHistory().push).toHaveBeenCalledWith(`/${team1.name}/channels/${gmChannel.name}`);
        });
    });

    describe('loadIfNecessaryAndSwitchToChannelById', () => {
        test('existing channel', () => {
            store.dispatch(Actions.loadIfNecessaryAndSwitchToChannelById(channel1.id));
            expect(getHistory().push).toHaveBeenCalledWith(`/${team1.name}/channels/${channel1.name}`);
        });

        test('non-existing channel', async () => {
            await store.dispatch(Actions.loadIfNecessaryAndSwitchToChannelById('non-existing-channelid'));
            expect(getChannel).toHaveBeenCalledWith('non-existing-channelid');
            expect(getHistory().push).toHaveBeenCalledWith(`/${team1.name}/channels/non-existing-channel`);
        });
    });

    describe('goToLastViewedChannel', () => {
        test('should switch to town square if last viewed channel is current channel', async () => {
            await store.dispatch(Actions.goToLastViewedChannel());
            expect(getHistory().push).toHaveBeenCalledWith(`/${team1.name}/channels/${General.DEFAULT_CHANNEL}`);
        });
    });

    describe('loadLatestPosts', () => {
        test('should call getPosts and return the results', async () => {
            const posts = {posts: {}, order: []};

            PostActions.getPosts.mockReturnValue(() => ({data: posts}));

            const result = await store.dispatch(Actions.loadLatestPosts('channel'));

            expect(result.data).toBe(posts);

            expect(PostActions.getPosts).toHaveBeenCalledWith('channel', 0, Posts.POST_CHUNK_SIZE / 2);
        });

        test('when oldest posts are recived', async () => {
            const posts = {posts: {}, order: new Array(Posts.POST_CHUNK_SIZE), next_post_id: 'test', prev_post_id: ''};

            PostActions.getPosts.mockReturnValue(() => ({data: posts}));

            const result = await store.dispatch(Actions.loadLatestPosts('channel'));

            expect(result.atLatestMessage).toBe(false);
            expect(result.atOldestmessage).toBe(true);
        });

        test('when latest posts are received', async () => {
            Date.now = jest.fn().mockReturnValue(12344);

            const posts = {posts: {}, order: new Array((Posts.POST_CHUNK_SIZE / 2) - 1), next_post_id: '', prev_post_id: 'test'};

            PostActions.getPosts.mockReturnValue(() => ({data: posts}));

            const result = await store.dispatch(Actions.loadLatestPosts('channel'));

            expect(result.atLatestMessage).toBe(true);
            expect(result.atOldestmessage).toBe(false);

            expect(store.getActions()).toEqual([
                {
                    channelId: 'channel',
                    time: 12344,
                    type: ActionTypes.RECEIVED_POSTS_FOR_CHANNEL_AT_TIME,
                },
            ]);
        });
    });

    describe('loadUnreads', () => {
        test('when there are no posts after and before the response', async () => {
            const posts = {posts: {}, order: [], next_post_id: '', prev_post_id: ''};

            PostActions.getPostsUnread.mockReturnValue(() => ({data: posts}));

            const result = await store.dispatch(Actions.loadUnreads('channel'));

            expect(result).toEqual({atLatestMessage: true, atOldestmessage: true});
            expect(PostActions.getPostsUnread).toHaveBeenCalledWith('channel');
        });

        test('when there are posts before and after the response', async () => {
            const posts = {
                posts: {},
                order: [
                    ...new Array(Posts.POST_CHUNK_SIZE / 2), // after
                    'post',
                    ...new Array(Posts.POST_CHUNK_SIZE / 2), // before
                ],
                next_post_id: 'test',
                prev_post_id: 'test',
            };

            PostActions.getPostsUnread.mockReturnValue(() => ({data: posts}));

            const result = await store.dispatch(Actions.loadUnreads('channel'));
            expect(result).toEqual({atLatestMessage: false, atOldestmessage: false});
            expect(PostActions.getPostsUnread).toHaveBeenCalledWith('channel');
        });

        test('when there are no posts after RECEIVED_POSTS_FOR_CHANNEL_AT_TIME should be dispatched', async () => {
            const posts = {posts: {}, order: [], next_post_id: '', prev_post_id: ''};
            Date.now = jest.fn().mockReturnValue(12344);

            PostActions.getPostsUnread.mockReturnValue(() => ({data: posts}));

            await store.dispatch(Actions.loadUnreads('channel'));

            expect(store.getActions()).toEqual([
                {
                    meta: {batch: true},
                    payload: [
                        {amount: 0, data: 'channel', type: 'INCREASE_POST_VISIBILITY'},
                        {
                            channelId: 'channel',
                            time: 12344,
                            type: 'RECEIVED_POSTS_FOR_CHANNEL_AT_TIME',
                        }],
                    type: 'BATCHING_REDUCER.BATCH',
                },
            ]);
        });

        test('should disptach PREFETCH_POSTS_FOR_CHANNEL status when called with prefetch argument and loadUnreads sucess', async () => {
            const posts = {posts: {}, order: [], next_post_id: '', prev_post_id: ''};

            PostActions.getPostsUnread.mockReturnValue(() => ({data: posts}));

            await store.dispatch(Actions.loadUnreads('channel', true));

            expect(store.getActions()).toEqual([{
                channelId: 'channel',
                status: RequestStatus.STARTED,
                type: 'PREFETCH_POSTS_FOR_CHANNEL',
            },
            {
                meta: {batch: true},
                payload: [
                    {amount: 0, data: 'channel', type: 'INCREASE_POST_VISIBILITY'},
                    {
                        channelId: 'channel',
                        status: RequestStatus.SUCCESS,
                        type: 'PREFETCH_POSTS_FOR_CHANNEL',
                    },
                    {
                        channelId: 'channel',
                        time: 12344,
                        type: 'RECEIVED_POSTS_FOR_CHANNEL_AT_TIME',
                    }],
                type: 'BATCHING_REDUCER.BATCH',
            },
            ]);
        });

        test('should disptach PREFETCH_POSTS_FOR_CHANNEL status when called with prefetch argument and loadUnreads error', async () => {
            PostActions.getPostsUnread.mockReturnValue(() => ({error: {}}));

            await store.dispatch(Actions.loadUnreads('channel', true));

            expect(store.getActions()).toEqual([{
                channelId: 'channel',
                status: RequestStatus.STARTED,
                type: 'PREFETCH_POSTS_FOR_CHANNEL',
            },
            {
                channelId: 'channel',
                status: RequestStatus.FAILURE,
                type: 'PREFETCH_POSTS_FOR_CHANNEL',
            },
            ]);
        });
    });

    describe('loadPostsAround', () => {
        test('should call getPostsAround and return the results', async () => {
            const posts = {posts: {}, order: [], next_post_id: '', prev_post_id: ''};

            PostActions.getPostsAround.mockReturnValue(() => ({data: posts}));

            const result = await store.dispatch(Actions.loadPostsAround('channel', 'post'));

            expect(result).toEqual({atLatestMessage: true, atOldestmessage: true});

            expect(PostActions.getPostsAround).toHaveBeenCalledWith('channel', 'post', Posts.POST_CHUNK_SIZE / 2);
        });

        test('when there are posts before and after reponse posts chunk', async () => {
            const posts = {
                posts: {},
                order: [
                    ...new Array(Posts.POST_CHUNK_SIZE / 2), // after
                    'post',
                    ...new Array(Posts.POST_CHUNK_SIZE / 2), // before
                ],
                next_post_id: 'test',
                prev_post_id: 'test',
            };

            PostActions.getPostsAround.mockReturnValue(() => ({data: posts}));

            const result = await store.dispatch(Actions.loadPostsAround('channel', 'post'));

            expect(result).toEqual({atLatestMessage: false, atOldestmessage: false});
        });

        test('when there are posts before the reponse posts chunk', async () => {
            const posts = {
                posts: {},
                order: [
                    ...new Array(Posts.POST_CHUNK_SIZE / 2), // after
                    'post',
                    ...new Array((Posts.POST_CHUNK_SIZE / 2) - 1), // before
                ],
                next_post_id: '',
                prev_post_id: 'test',
            };

            PostActions.getPostsAround.mockReturnValue(() => ({data: posts}));

            const result = await store.dispatch(Actions.loadPostsAround('channel', 'post'));

            expect(result).toEqual({atLatestMessage: true, atOldestmessage: false});
        });

        test('when there are posts before the reponse posts chunk', async () => {
            const posts = {
                posts: {},
                order: [
                    ...new Array((Posts.POST_CHUNK_SIZE / 2) - 1), // after
                    'post',
                    ...new Array(Posts.POST_CHUNK_SIZE / 2), // before
                ],
                next_post_id: 'test',
                prev_post_id: '',
            };

            PostActions.getPostsAround.mockReturnValue(() => ({data: posts}));

            const result = await store.dispatch(Actions.loadPostsAround('channel', 'post'));

            expect(result).toEqual({atLatestMessage: false, atOldestmessage: true});
        });

        test('when there are no posts before and after the posts chunk', async () => {
            const posts = {
                posts: {},
                order: [
                    ...new Array((Posts.POST_CHUNK_SIZE / 2) - 1), // after
                    'post',
                    ...new Array((Posts.POST_CHUNK_SIZE / 2) - 1), // before
                ],
                next_post_id: '',
                prev_post_id: '',
            };

            PostActions.getPostsAround.mockReturnValue(() => ({data: posts}));

            const result = await store.dispatch(Actions.loadPostsAround('channel', 'post'));

            expect(result).toEqual({atLatestMessage: true, atOldestmessage: true});
        });
    });

    describe('increasePostVisibility', () => {
        test('should dispatch the correct actions', async () => {
            const posts = {
                posts: {},
                order: new Array(7),
                prev_post_id: '',
                next_post_id: '',
            };

            PostActions.getPostsBefore.mockReturnValue(() => ({data: posts}));

            await store.dispatch(Actions.loadPosts({channelId: 'current_channel_id', postId: 'oldest_post_id', type: PostRequestTypes.BEFORE_ID}));

            expect(store.getActions()).toEqual([
                {channelId: 'current_channel_id', data: true, type: 'LOADING_POSTS'},
                {
                    meta: {batch: true},
                    payload: [
                        {channelId: 'current_channel_id', data: false, type: 'LOADING_POSTS'},
                        {amount: 7, data: 'current_channel_id', type: 'INCREASE_POST_VISIBILITY'},
                    ],
                    type: 'BATCHING_REDUCER.BATCH',
                },
            ]);
        });

        test('should increase post visibility when receiving posts', async () => {
            Date.now = jest.fn().mockReturnValue(12344);

            const channelId = 'channel1';
            const posts = {
                posts: {},
                order: new Array(7),
            };

            PostActions.getPostsBefore.mockReturnValue(() => ({data: posts}));

            await store.dispatch(Actions.loadPosts({channelId, postId: 'oldest_post_id', type: PostRequestTypes.BEFORE_ID}));

            expect(store.getActions()).toContainEqual({
                meta: {batch: true},
                payload: [
                    {
                        type: ActionTypes.LOADING_POSTS,
                        channelId,
                        data: false,
                    },
                    {
                        type: ActionTypes.INCREASE_POST_VISIBILITY,
                        amount: posts.order.length,
                        data: channelId,
                    },
                ],
                type: 'BATCHING_REDUCER.BATCH',
            });
        });

        test('should return more to load when enough posts are received', async () => {
            const channelId = 'channel1';
            const posts = {
                posts: {},
                order: new Array(Posts.POST_CHUNK_SIZE / 2),
                prev_post_id: 'saasdsd',
            };

            PostActions.getPostsBefore.mockReturnValue(() => ({data: posts}));

            const result = await store.dispatch(Actions.loadPosts({channelId, postId: 'oldest_post_id', type: PostRequestTypes.BEFORE_ID}));

            expect(result).toEqual({
                moreToLoad: true,
            });
        });

        test('should not return more to load when not enough posts are received', async () => {
            const channelId = 'channel1';
            const posts = {
                posts: {},
                order: new Array((Posts.POST_CHUNK_SIZE / 2) - 1),
                prev_post_id: '',
            };

            PostActions.getPostsBefore.mockReturnValue(() => ({data: posts}));

            const result = await store.dispatch(Actions.loadPosts({channelId, postId: 'oldest_post_id', type: PostRequestTypes.BEFORE_ID}));

            expect(result).toEqual({
                moreToLoad: false,
            });
        });

        test('should return error from getPostsBefore', async () => {
            const channelId = 'channel1';
            const error = {message: 'something went wrong'};

            PostActions.getPostsBefore.mockReturnValue(() => ({error}));

            const result = await store.dispatch(Actions.loadPosts({channelId, postId: 'oldest_post_id', type: PostRequestTypes.BEFORE_ID}));

            expect(result).toEqual({
                error,
                moreToLoad: true,
            });
        });
    });

    describe('syncPostsInChannel', () => {
        test('should call getPostsSince with since argument time as last discconet was earlier than lastGetPosts', async () => {
            const channelId = 'channel1';
            PostActions.getPostsSince.mockReturnValue(() => ({data: []}));

            store = mockStore({
                ...initialState,
                views: {
                    ...initialState.views,
                    channel: {
                        ...initialState.views.channel,
                        lastGetPosts: {
                            [channelId]: 12345,
                        },
                    },
                },
                websocket: {
                    lastDisconnectAt: 12344,
                },
            });

            await store.dispatch(Actions.syncPostsInChannel(channelId, 12350));
            expect(PostActions.getPostsSince).toHaveBeenCalledWith(channelId, 12350);
        });

        test('should call getPostsSince with lastDisconnect time as last discconet was later than lastGetPosts', async () => {
            const channelId = 'channel1';
            PostActions.getPostsSince.mockReturnValue(() => ({data: []}));

            store = mockStore({
                ...initialState,
                views: {
                    ...initialState.views,
                    channel: {
                        ...initialState.views.channel,
                        lastGetPosts: {
                            [channelId]: 12343,
                        },
                    },
                },
                websocket: {
                    lastDisconnectAt: 12344,
                },
            });

            await store.dispatch(Actions.syncPostsInChannel(channelId, 12355));
            expect(PostActions.getPostsSince).toHaveBeenCalledWith(channelId, 12343);
        });
    });

    describe('markChannelAsReadOnFocus', () => {
        test('should mark channel as read when channel is not manually unread', async () => {
            test = mockStore(initialState);

            await store.dispatch(Actions.markChannelAsReadOnFocus(channel1.id));

            expect(markChannelAsRead).toHaveBeenCalledWith(channel1.id);
        });

        test('should not mark channel as read when channel is manually unread', async () => {
            store = mockStore({
                ...initialState,
                entities: {
                    ...initialState.entities,
                    channels: {
                        ...initialState.entities.channels,
                        manuallyUnread: {
                            [channel1.id]: true,
                        },
                    },
                },
            });

            await store.dispatch(Actions.markChannelAsReadOnFocus(channel1.id));

            expect(markChannelAsRead).not.toHaveBeenCalled();
        });

        test('should match actions for PREFETCH_POSTS_FOR_CHANNEL when prefetch argument and getPostsSince sucess', async () => {
            const channelId = 'channel1';
            PostActions.getPostsSince.mockReturnValue(() => ({data: []}));

            store = mockStore({
                ...initialState,
                views: {
                    ...initialState.views,
                    channel: {
                        ...initialState.views.channel,
                        lastGetPosts: {
                            [channelId]: 12345,
                        },
                    },
                },
                websocket: {
                    lastDisconnectAt: 12344,
                },
            });

            await store.dispatch(Actions.syncPostsInChannel(channelId, 12350, true));

            expect(store.getActions()).toEqual([{
                channelId: 'channel1',
                status: RequestStatus.STARTED,
                type: 'PREFETCH_POSTS_FOR_CHANNEL',
            },
            {
                meta: {batch: true},
                payload: [{
                    channelId: 'channel1',
                    time: 12344,
                    type: 'RECEIVED_POSTS_FOR_CHANNEL_AT_TIME',
                }, {
                    channelId: 'channel1',
                    status: RequestStatus.SUCCESS,
                    type: 'PREFETCH_POSTS_FOR_CHANNEL',
                }],
                type: 'BATCHING_REDUCER.BATCH',
            },
            ]);
        });

        test('should match actions for PREFETCH_POSTS_FOR_CHANNEL when prefetch argument and getPostsSince failure', async () => {
            const channelId = 'channel1';
            PostActions.getPostsSince.mockReturnValue(() => ({error: {}}));

            store = mockStore({
                ...initialState,
                views: {
                    ...initialState.views,
                    channel: {
                        ...initialState.views.channel,
                        lastGetPosts: {
                            [channelId]: 12345,
                        },
                    },
                },
                websocket: {
                    lastDisconnectAt: 12344,
                },
            });

            await store.dispatch(Actions.syncPostsInChannel(channelId, 12350, true));

            expect(store.getActions()).toEqual([{
                channelId: 'channel1',
                status: RequestStatus.STARTED,
                type: 'PREFETCH_POSTS_FOR_CHANNEL',
            },
            {
                meta: {batch: true},
                payload: [{
                    channelId: 'channel1',
                    status: RequestStatus.FAILURE,
                    type: 'PREFETCH_POSTS_FOR_CHANNEL',
                }],
                type: 'BATCHING_REDUCER.BATCH',
            },
            ]);
        });
    });

    describe('updateToastStatus', () => {
        test('should disptach updateToastStatus action with the true as argument', async () => {
            await store.dispatch(Actions.updateToastStatus(true));

            expect(store.getActions()).toEqual([{
                data: true,
                type: 'UPDATE_TOAST_STATUS',
            }]);
        });
    });

    describe('prefetchChannelPosts', () => {
        test('should call for loadUnreads if there are no posts in channel', async () => {
            await store.dispatch(Actions.prefetchChannelPosts('channelid1'));
            expect(PostActions.getPostsUnread).toHaveBeenCalledWith('channelid1');
        });

        test('should call for syncPostsInChannel if there are posts in channel', async () => {
            store = mockStore({
                ...initialState,
                entities: {
                    ...initialState.entities,
                    posts: {
                        ...initialState.entities.posts,
                        postsInChannel: {
                            channelid1: [{order: ['postId'], recent: true}],
                        },
                        posts: {
                            postId: {create_at: 1234},
                        },
                    },
                },
                views: {
                    ...initialState.views,
                    channel: {
                        ...initialState.views.channel,
                        lastGetPosts: {
                            channelid1: 12345,
                        },
                    },
                },
                websocket: {
                    lastDisconnectAt: 12344,
                },
            });

            await store.dispatch(Actions.prefetchChannelPosts('channelid1'));
            expect(PostActions.getPostsSince).toHaveBeenCalledWith('channelid1', 1234);
        });

        test('should not call for getPostsUnread and not syncPostsInChannel if there are posts but not recent chunk', async () => {
            store = mockStore({
                ...initialState,
                entities: {
                    ...initialState.entities,
                    posts: {
                        ...initialState.entities.posts,
                        postsInChannel: {
                            channelid1: [{order: ['postId'], recent: false}],
                        },
                        posts: {
                            postId: {create_at: 1234},
                        },
                    },
                },
                views: {
                    ...initialState.views,
                    channel: {
                        ...initialState.views.channel,
                        lastGetPosts: {
                            channelid1: 12345,
                        },
                    },
                },
                websocket: {
                    lastDisconnectAt: 12344,
                },
            });

            await store.dispatch(Actions.prefetchChannelPosts('channelid1'));
            expect(PostActions.getPostsUnread).toHaveBeenCalledWith('channelid1');
            expect(PostActions.getPostsSince).not.toHaveBeenCalled();
        });

        test('should call for loadUnreads after a delay', async () => {
            jest.useFakeTimers();
            const posts = {posts: {}, order: [], next_post_id: '', prev_post_id: ''};
            PostActions.getPostsUnread.mockReturnValue(() => ({data: posts}));
            store.dispatch(Actions.prefetchChannelPosts('channelid1', 500));
            expect(PostActions.getPostsUnread).not.toHaveBeenCalled();
            jest.runOnlyPendingTimers();
            await Promise.resolve();
            expect(PostActions.getPostsUnread).toHaveBeenCalledWith('channelid1');
            jest.useRealTimers();
        });
    });

    describe('autocompleteUsersInChannel', () => {
        test('should return empty arrays if the key is missing in reponse', async () => {
            UserActions.autocompleteUsers.mockReturnValue(() => ({data: {}}));
            const response = await store.dispatch(Actions.autocompleteUsersInChannel('test', 'channelid1'));
            expect(response).toStrictEqual({data: {out_of_channel: [], users: []}});
        });
    });
});

describe('leaveChannel', () => {
    const currentUser = TestHelper.getUserMock({id: 'currentUser'});
    const currentTeam = TestHelper.getTeamMock({id: 'currentTeam'});

    const initialState = {
        entities: {
            channels: {
                myMembers: {},
            },
            teams: {
                currentTeamId: currentTeam.id,
                teams: {
                    [currentTeam.id]: currentTeam,
                },
            },
            users: {
                currentUserId: currentUser.id,
                profiles: {
                    [currentUser.id]: currentUser,
                },
            },
        },
    };

    test('should delete the channel and its posts from the store', async () => {
        const channel1 = TestHelper.getChannelMock({id: 'channel1', team_id: currentTeam.id});
        const post1 = TestHelper.getPostMock({id: 'post1', channel_id: channel1.id});

        const store = configureStore(mergeObjects(initialState, {
            entities: {
                channels: {
                    channels: {
                        [channel1.id]: channel1,
                    },
                    myMembers: {
                        [channel1.id]: TestHelper.getChannelMembershipMock({user_id: currentUser.id, channel_id: channel1.id}),
                    },
                },
                posts: {
                    posts: {
                        [post1.id]: post1,
                    },
                },
            },
        }));

        await store.dispatch(Actions.leaveChannel(channel1.id));

        const state = store.getState();
        expect(state.entities.channels.channels[channel1.id]).not.toBeDefined();
        expect(state.entities.posts.posts[post1.id]).not.toBeDefined();
    });

    test('should send you back to the root of the team when leaving the current channel if you have other channels on that team', async () => {
        const channel1 = TestHelper.getChannelMock({id: 'channel1', team_id: currentTeam.id});
        const channel2 = TestHelper.getChannelMock({id: 'channel2', team_id: currentTeam.id});
        const post1 = TestHelper.getPostMock({id: 'post1', channel_id: channel1.id});

        const store = configureStore(mergeObjects(initialState, {
            entities: {
                channels: {
                    channels: {
                        [channel1.id]: channel1,
                        [channel2.id]: channel2,
                    },
                    channelsInTeam: {
                        [currentTeam.id]: [channel1.id, channel2.id],
                    },
                    currentChannelId: channel1.id,
                    myMembers: {
                        [channel1.id]: TestHelper.getChannelMembershipMock({user_id: currentUser.id, channel_id: channel1.id}),
                        [channel2.id]: TestHelper.getChannelMembershipMock({user_id: currentUser.id, channel_id: channel2.id}),
                    },
                },
                posts: {
                    posts: {
                        [post1.id]: post1,
                    },
                },
            },
        }));

        await store.dispatch(Actions.leaveChannel(channel1.id));

        expect(getHistory().push).toHaveBeenCalledWith(`/${currentTeam.name}`);
    });

    test("should send you back to the root of the server when leaving a channel if you don't have other channels on that team", async () => {
        const channel1 = TestHelper.getChannelMock({id: 'channel1', team_id: currentTeam.id});
        const post1 = TestHelper.getPostMock({id: 'post1', channel_id: channel1.id});

        const store = configureStore(mergeObjects(initialState, {
            entities: {
                channels: {
                    channels: {
                        [channel1.id]: channel1,
                    },
                    channelsInTeam: {
                        [currentTeam.id]: [channel1.id],
                    },
                    currentChannelId: channel1.id,
                    myMembers: {
                        [channel1.id]: TestHelper.getChannelMembershipMock({user_id: currentUser.id, channel_id: channel1.id}),
                    },
                },
                posts: {
                    posts: {
                        [post1.id]: post1,
                    },
                },
            },
        }));

        await store.dispatch(Actions.leaveChannel(channel1.id));

        expect(getHistory().push).toHaveBeenCalledWith('/');
    });

    test("should close the RHS if it's open to a post in the channel that was deleted", async () => {
        const channel1 = TestHelper.getChannelMock({id: 'channel1', team_id: currentTeam.id});
        const channel2 = TestHelper.getChannelMock({id: 'channel2', team_id: currentTeam.id});
        const post1 = TestHelper.getPostMock({id: 'post1', channel_id: channel1.id});
        const post2 = TestHelper.getPostMock({id: 'post2', channel_id: channel2.id});

        const store = configureStore(mergeObjects(initialState, {
            entities: {
                channels: {
                    channels: {
                        [channel1.id]: channel1,
                        [channel2.id]: channel2,
                    },
                    myMembers: {
                        [channel1.id]: TestHelper.getChannelMembershipMock({user_id: currentUser.id, channel_id: channel1.id}),
                        [channel2.id]: TestHelper.getChannelMembershipMock({user_id: currentUser.id, channel_id: channel2.id}),
                    },
                },
                posts: {
                    posts: {
                        [post1.id]: post1,
                        [post2.id]: post2,
                    },
                },
            },
            views: {
                rhs: {
                    selectedChannelId: channel1.id,
                    selectedPostId: post1.id,
                },
            },
        }));

        await store.dispatch(Actions.leaveChannel(channel1.id));

        const state = store.getState();
        expect(state.views.rhs.selectedChannelId).toEqual('');
        expect(state.views.rhs.selectedPostId).toEqual('');
    });

    test("should not close the RHS if it's open to a post in another channel", async () => {
        const team1 = TestHelper.getTeamMock({id: 'team1'});
        const channel1 = TestHelper.getChannelMock({id: 'channel1', team_id: team1.id});
        const channel2 = TestHelper.getChannelMock({id: 'channel2', team_id: team1.id});
        const post1 = TestHelper.getPostMock({id: 'post1', channel_id: channel1.id});
        const post2 = TestHelper.getPostMock({id: 'post2', channel_id: channel2.id});

        const store = configureStore(mergeObjects(initialState, {
            entities: {
                channels: {
                    channels: {
                        [channel1.id]: channel1,
                        [channel2.id]: channel2,
                    },
                    myMembers: {
                        [channel1.id]: TestHelper.getChannelMembershipMock({user_id: currentUser.id, channel_id: channel1.id}),
                        [channel2.id]: TestHelper.getChannelMembershipMock({user_id: currentUser.id, channel_id: channel2.id}),
                    },
                },
                posts: {
                    posts: {
                        [post1.id]: post1,
                        [post2.id]: post2,
                    },
                },
                teams: {
                    currentTeamId: team1.id,
                    teams: {
                        [team1.id]: team1,
                    },
                },
            },
            views: {
                rhs: {
                    selectedChannelId: channel2.id,
                    selectedPostId: post2.id,
                },
            },
        }));

        await store.dispatch(Actions.leaveChannel(channel1.id));

        const state = store.getState();
        expect(state.views.rhs.selectedChannelId).toEqual(channel2.id);
        expect(state.views.rhs.selectedPostId).toEqual(post2.id);
    });
});

describe('deleteChannel', () => {
    test('should delete the channel and its posts from the store', async () => {
        const channel1 = TestHelper.getChannelMock({id: 'channel1'});
        const post1 = TestHelper.getPostMock({id: 'post1', channel_id: channel1.id});

        const store = configureStore({
            entities: {
                channels: {
                    channels: {
                        [channel1.id]: channel1,
                    },
                },
                posts: {
                    posts: {
                        [post1.id]: post1,
                    },
                },
            },
        });

        nock(Client4.getBaseRoute()).
            delete(`/channels/${channel1.id}`).
            reply(200, {status: 'OK'});

        await store.dispatch(Actions.deleteChannel(channel1.id));

        const state = store.getState();
        expect(state.entities.channels.channels[channel1.id].delete_at).toBeGreaterThan(0);
        expect(state.entities.posts.posts[post1.id]).not.toBeDefined();
    });

    test("should close the RHS if it's open to a post in the channel that was deleted", async () => {
        const channel1 = TestHelper.getChannelMock({id: 'channel1'});
        const channel2 = TestHelper.getChannelMock({id: 'channel2'});
        const post1 = TestHelper.getPostMock({id: 'post1', channel_id: channel1.id});
        const post2 = TestHelper.getPostMock({id: 'post2', channel_id: channel2.id});

        const store = configureStore({
            entities: {
                channels: {
                    channels: {
                        [channel1.id]: channel1,
                        [channel2.id]: channel2,
                    },
                },
                posts: {
                    posts: {
                        [post1.id]: post1,
                        [post2.id]: post2,
                    },
                },
            },
            views: {
                rhs: {
                    selectedChannelId: channel1.id,
                    selectedPostId: post1.id,
                },
            },
        });

        nock(Client4.getBaseRoute()).
            delete(`/channels/${channel1.id}`).
            reply(200, {status: 'OK'});

        await store.dispatch(Actions.deleteChannel(channel1.id));

        const state = store.getState();
        expect(state.views.rhs.selectedChannelId).toEqual('');
        expect(state.views.rhs.selectedPostId).toEqual('');
    });

    test("should not close the RHS if it's open to a post in another channel", async () => {
        const channel1 = TestHelper.getChannelMock({id: 'channel1'});
        const channel2 = TestHelper.getChannelMock({id: 'channel2'});
        const post1 = TestHelper.getPostMock({id: 'post1', channel_id: channel1.id});
        const post2 = TestHelper.getPostMock({id: 'post2', channel_id: channel2.id});

        const store = configureStore({
            entities: {
                channels: {
                    channels: {
                        [channel1.id]: channel1,
                        [channel2.id]: channel2,
                    },
                },
                posts: {
                    posts: {
                        [post1.id]: post1,
                        [post2.id]: post2,
                    },
                },
            },
            views: {
                rhs: {
                    selectedChannelId: channel2.id,
                    selectedPostId: post2.id,
                },
            },
        });

        nock(Client4.getBaseRoute()).
            delete(`/channels/${channel1.id}`).
            reply(200, {status: 'OK'});

        await store.dispatch(Actions.deleteChannel(channel1.id));

        const state = store.getState();
        expect(state.views.rhs.selectedChannelId).toEqual(channel2.id);
        expect(state.views.rhs.selectedPostId).toEqual(post2.id);
    });
});
