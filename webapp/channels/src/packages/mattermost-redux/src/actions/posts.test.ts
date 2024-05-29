// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'fs';

import nock from 'nock';

import type {Post, PostList} from '@mattermost/types/posts';
import type {GlobalState} from '@mattermost/types/store';

import {PostTypes, UserTypes} from 'mattermost-redux/action_types';
import {getChannelStats} from 'mattermost-redux/actions/channels';
import {createCustomEmoji} from 'mattermost-redux/actions/emojis';
import * as Actions from 'mattermost-redux/actions/posts';
import {loadMe} from 'mattermost-redux/actions/users';
import {Client4} from 'mattermost-redux/client';
import type {GetStateFunc} from 'mattermost-redux/types/actions';
import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';

import mockStore from 'tests/test_store';

import TestHelper from '../../test/test_helper';
import configureStore from '../../test/test_store';
import {Preferences, Posts, RequestStatus} from '../constants';

const OK_RESPONSE = {status: 'OK'};

jest.mock('mattermost-redux/actions/status_profile_polling', () => ({
    batchFetchStatusesProfilesGroupsFromPosts: jest.fn(() => {
        return {type: ''};
    }),
}));

describe('Actions.Posts', () => {
    let store = configureStore();
    beforeAll(() => {
        TestHelper.initBasic(Client4);
    });

    beforeEach(() => {
        store = configureStore({
            entities: {
                general: {
                    config: {
                        CollapsedThreads: 'always_on',
                        EnableJoinLeaveMessageByDefault: 'true',
                    },
                },
            },
        });
    });
    afterAll(() => {
        TestHelper.tearDown();
    });

    it('createPost', async () => {
        const channelId = TestHelper.basicChannel!.id;
        const post = TestHelper.fakePost(channelId);

        nock(Client4.getBaseRoute()).
            post('/posts').
            reply(201, {...post, id: TestHelper.generateId()});

        await store.dispatch(Actions.createPost(post));

        const state: GlobalState = store.getState();
        const createRequest = state.requests.posts.createPost;
        if (createRequest.status === RequestStatus.FAILURE) {
            throw new Error(JSON.stringify(createRequest.error));
        }

        const {posts, postsInChannel} = state.entities.posts;
        expect(posts).toBeTruthy();
        expect(postsInChannel).toBeTruthy();

        let found = false;
        for (const storedPost of Object.values(posts)) {
            if (storedPost.message === post.message) {
                found = true;
                break;
            }
        }

        // failed to find new post in posts
        expect(found).toBeTruthy();

        // postsInChannel[channelId] should not exist as create post should not add entry to postsInChannel when it did not exist before
        // postIds in channel do not exist
        expect(!postsInChannel[channelId]).toBeTruthy();
    });

    it('maintain postReplies', async () => {
        const channelId = TestHelper.basicChannel!.id;
        const post = TestHelper.fakePost(channelId);
        const postId = TestHelper.generateId();

        nock(Client4.getBaseRoute()).
            post('/posts').
            reply(201, {...post, id: postId});

        await store.dispatch(Actions.createPostImmediately(post));

        const post2 = TestHelper.fakePostWithId(channelId);
        post2.root_id = postId;

        nock(Client4.getBaseRoute()).
            post('/posts').
            reply(201, post2);

        await store.dispatch(Actions.createPostImmediately(post2));

        expect(store.getState().entities.posts.postsReplies[postId]).toBe(1);

        nock(Client4.getBaseRoute()).
            delete(`/posts/${post2.id}`).
            reply(200, OK_RESPONSE);

        await store.dispatch(Actions.deletePost(post2));
        await store.dispatch(Actions.removePost(post2));

        expect(store.getState().entities.posts.postsReplies[postId]).toBe(0);
    });

    it('resetCreatePostRequest', async () => {
        const channelId = TestHelper.basicChannel!.id;
        const post = TestHelper.fakePost(channelId);
        const createPostError = {
            message: 'Invalid RootId parameter',
            server_error_id: 'api.post.create_post.root_id.app_error',
            status_code: 400,
            url: 'http://localhost:8065/api/v4/posts',
        };

        nock(Client4.getBaseRoute()).
            post('/posts').
            reply(400, createPostError);

        await store.dispatch(Actions.createPost(post));
        await TestHelper.wait(50);

        let state = store.getState();
        let createRequest = state.requests.posts.createPost;
        if (createRequest.status !== RequestStatus.FAILURE) {
            throw new Error(JSON.stringify(createRequest.error));
        }

        expect(createRequest.status).toEqual(RequestStatus.FAILURE);
        expect(createRequest.error.message).toEqual(createPostError.message);
        expect(createRequest.error.status_code).toEqual(createPostError.status_code);

        store.dispatch(Actions.resetCreatePostRequest());
        await TestHelper.wait(50);

        state = store.getState();
        createRequest = state.requests.posts.createPost;
        if (createRequest.status === RequestStatus.FAILURE) {
            throw new Error(JSON.stringify(createRequest.error));
        }

        expect(createRequest.status).toEqual(RequestStatus.NOT_STARTED);
        expect(createRequest.error).toBe(null);
    });

    it('createPost with file attachments', async () => {
        const channelId = TestHelper.basicChannel!.id;
        const post = TestHelper.fakePost(channelId);
        const files = TestHelper.fakeFiles(3);

        nock(Client4.getBaseRoute()).
            post('/posts').
            reply(201, {...post, id: TestHelper.generateId(), file_ids: [files[0].id, files[1].id, files[2].id]});

        await store.dispatch(Actions.createPost(
            post,
            files,
        ));

        const state: GlobalState = store.getState();
        const createRequest = state.requests.posts.createPost;
        if (createRequest.status === RequestStatus.FAILURE) {
            throw new Error(JSON.stringify(createRequest.error));
        }

        let newPost: Post;
        for (const storedPost of Object.values(state.entities.posts.posts)) {
            if (storedPost.message === post.message) {
                newPost = storedPost;
                break;
            }
        }

        // failed to find new post in posts
        expect(newPost!).toBeTruthy();

        let found = true;
        for (const file of files) {
            if (!state.entities.files.files[file.id]) {
                found = false;
                break;
            }
        }

        // failed to find uploaded files in files
        expect(found).toBeTruthy();

        const postIdForFiles = state.entities.files.fileIdsByPostId[newPost!.id];

        // failed to find files for post id in files Ids by post id
        expect(postIdForFiles).toBeTruthy();

        expect(postIdForFiles.length).toBe(files.length);
    });

    it('editPost', async () => {
        const channelId = TestHelper.basicChannel!.id;

        nock(Client4.getBaseRoute()).
            post('/posts').
            reply(201, TestHelper.fakePostWithId(channelId));

        const post = await Client4.createPost(
            TestHelper.fakePost(channelId),
        );
        const message = post.message;

        post.message = `${message} (edited)`;

        nock(Client4.getBaseRoute()).
            put(`/posts/${post.id}/patch`).
            reply(200, post);

        await store.dispatch(Actions.editPost(
            post,
        ));

        const state: GlobalState = store.getState();
        const editRequest = state.requests.posts.editPost;
        const {posts} = state.entities.posts;

        if (editRequest.status === RequestStatus.FAILURE) {
            throw new Error(JSON.stringify(editRequest.error));
        }

        expect(posts).toBeTruthy();
        expect(posts[post.id]).toBeTruthy();

        expect(
            posts[post.id].message).toEqual(
            `${message} (edited)`,
        );
    });

    it('deletePost', async () => {
        const channelId = TestHelper.basicChannel!.id;

        nock(Client4.getBaseRoute()).
            post('/posts').
            reply(201, TestHelper.fakePostWithId(channelId));
        await store.dispatch(Actions.createPost(TestHelper.fakePost(channelId)));
        const initialPosts = store.getState().entities.posts;
        const postId = Object.keys(initialPosts.posts)[0];

        nock(Client4.getBaseRoute()).
            delete(`/posts/${postId}`).
            reply(200, OK_RESPONSE);

        await store.dispatch(Actions.deletePost(initialPosts.posts[postId]));

        const state: GlobalState = store.getState();
        const {posts} = state.entities.posts;

        expect(posts).toBeTruthy();
        expect(posts[postId]).toBeTruthy();
        expect(
            posts[postId].state).toEqual(
            Posts.POST_DELETED,
        );
    });

    it('deletePostWithReaction', async () => {
        TestHelper.mockLogin();
        store.dispatch({
            type: UserTypes.LOGIN_SUCCESS,
        });
        await store.dispatch(loadMe());

        nock(Client4.getBaseRoute()).
            post('/posts').
            reply(201, TestHelper.fakePostWithId(TestHelper.basicChannel!.id));

        const post1 = await Client4.createPost(
            TestHelper.fakePost(TestHelper.basicChannel!.id),
        );

        const emojiName = '+1';

        nock(Client4.getBaseRoute()).
            post('/reactions').
            reply(201, {user_id: TestHelper.basicUser!.id, post_id: post1.id, emoji_name: emojiName, create_at: 1508168444721});
        await store.dispatch(Actions.addReaction(post1.id, emojiName));

        let reactions = store.getState().entities.posts.reactions;
        expect(reactions).toBeTruthy();
        expect(reactions[post1.id]).toBeTruthy();
        expect(reactions[post1.id][TestHelper.basicUser!.id + '-' + emojiName]).toBeTruthy();

        nock(Client4.getBaseRoute()).
            delete(`/posts/${post1.id}`).
            reply(200, OK_RESPONSE);

        await store.dispatch(Actions.deletePost(post1));

        reactions = store.getState().entities.posts.reactions;
        expect(reactions).toBeTruthy();
        expect(!reactions[post1.id]).toBeTruthy();
    });

    it('removePost', async () => {
        const post1 = TestHelper.getPostMock({id: 'post1', channel_id: 'channel1', create_at: 1001, message: ''});
        const post2 = TestHelper.getPostMock({id: 'post2', channel_id: 'channel1', create_at: 1002, message: '', is_pinned: true});
        const post3 = TestHelper.getPostMock({id: 'post3', channel_id: 'channel1', root_id: 'post2', create_at: 1003, message: ''});
        const post4 = TestHelper.getPostMock({id: 'post4', channel_id: 'channel1', root_id: 'post1', create_at: 1004, message: ''});

        store = configureStore({
            entities: {
                posts: {
                    posts: {
                        post1,
                        post2,
                        post3,
                        post4,
                    },
                    postsInChannel: {
                        channel1: [
                            {order: ['post4', 'post3', 'post2', 'post1'], recent: false},
                        ],
                    },
                    postsInThread: {
                        post1: ['post4'],
                        post2: ['post3'],
                    },
                },
                channels: {
                    stats: {
                        channel1: {
                            pinnedpost_count: 2,
                        },
                    },
                },
            },
        });

        await store.dispatch(Actions.removePost(post2));

        const state: GlobalState = store.getState();
        const {stats} = state.entities.channels;
        const pinnedPostCount = stats.channel1.pinnedpost_count;

        expect(state.entities.posts.posts).toEqual({
            post1,
            post4,
        });
        expect(state.entities.posts.postsInChannel).toEqual({
            channel1: [
                {order: ['post4', 'post1'], recent: false},
            ],
        });
        expect(state.entities.posts.postsInThread).toEqual({
            post1: ['post4'],
        });
        expect(pinnedPostCount).toEqual(1);
    });

    it('removePostWithReaction', async () => {
        TestHelper.mockLogin();
        store.dispatch({
            type: UserTypes.LOGIN_SUCCESS,
        });
        await store.dispatch(loadMe());

        nock(Client4.getBaseRoute()).
            post('/posts').
            reply(201, TestHelper.fakePostWithId(TestHelper.basicChannel!.id));
        const post1 = await Client4.createPost(
            TestHelper.fakePost(TestHelper.basicChannel!.id),
        );

        const emojiName = '+1';

        nock(Client4.getBaseRoute()).
            post('/reactions').
            reply(201, {user_id: TestHelper.basicUser!.id, post_id: post1.id, emoji_name: emojiName, create_at: 1508168444721});
        await store.dispatch(Actions.addReaction(post1.id, emojiName));

        let reactions = store.getState().entities.posts.reactions;
        expect(reactions).toBeTruthy();
        expect(reactions[post1.id]).toBeTruthy();
        expect(reactions[post1.id][TestHelper.basicUser!.id + '-' + emojiName]).toBeTruthy();

        await store.dispatch(Actions.removePost(post1));

        reactions = store.getState().entities.posts.reactions;
        expect(reactions).toBeTruthy();
        expect(!reactions[post1.id]).toBeTruthy();
    });

    it('getPostsUnread', async () => {
        const {dispatch, getState} = store;
        const channelId = TestHelper.basicChannel!.id;
        const post = TestHelper.fakePostWithId(channelId);
        const userId = getState().entities.users.currentUserId;
        const response = {
            posts: {
                [post.id]: post,
            },
            order: [post.id],
            next_post_id: '',
            prev_post_id: '',
        };

        nock(Client4.getUsersRoute()).
            get(`/${userId}/channels/${channelId}/posts/unread`).
            query(true).
            reply(200, response);

        await dispatch(Actions.getPostsUnread(channelId));
        const {posts} = getState().entities.posts;

        expect(posts[post.id]).toBeTruthy();
    });

    it('getPostsUnread should load recent posts when unreadScrollPosition is startFromNewest and unread posts are not the latestPosts', async () => {
        const mockStore = configureStore({
            entities: {
                general: {
                    config: {
                        CollapsedThreads: 'always_on',
                    },
                },
                preferences: {
                    myPreferences: {
                        'advanced_settings--unread_scroll_position': {
                            category: 'advanced_settings',
                            name: 'unread_scroll_position',
                            value: Preferences.UNREAD_SCROLL_POSITION_START_FROM_NEWEST,
                        },
                    },
                },
            },
        });

        const {dispatch, getState} = mockStore;

        const userId = getState().entities.users.currentUserId;
        const channelId = TestHelper.basicChannel!.id;
        const post = TestHelper.fakePostWithId(channelId);
        const recentPost = TestHelper.fakePostWithId(channelId);

        const response = {
            posts: {
                [post.id]: post,
            },
            order: [post.id],
            next_post_id: recentPost.id,
            prev_post_id: '',
        };

        const responseWithRecentPosts = {
            posts: {
                [recentPost.id]: recentPost,
            },
            order: [recentPost.id],
            next_post_id: '',
            prev_post_id: '',
        };

        nock(Client4.getUsersRoute()).
            get(`/${userId}/channels/${channelId}/posts/unread`).
            query(true).
            reply(200, response);

        nock(Client4.getChannelsRoute()).
            get(`/${channelId}/posts`).
            query(true).
            reply(200, responseWithRecentPosts);

        await dispatch(Actions.getPostsUnread(channelId));
        const {posts} = getState().entities.posts;

        expect(posts[recentPost.id]).toBeTruthy();
    });

    it('getPostThread', async () => {
        const channelId = TestHelper.basicChannel!.id;
        const post = TestHelper.getPostMock({id: TestHelper.generateId(), channel_id: channelId, message: ''});
        const comment = {id: TestHelper.generateId(), root_id: post.id, channel_id: channelId, message: ''};

        store.dispatch(Actions.receivedPostsInChannel({order: [post.id], posts: {[post.id]: post}} as PostList, channelId));

        const postList = {
            order: [post.id],
            posts: {
                [post.id]: post,
                [comment.id]: comment,
            },
        };

        nock(Client4.getBaseRoute()).
            get(`/posts/${post.id}/thread?skipFetchThreads=false&collapsedThreads=true&collapsedThreadsExtended=false&direction=down&perPage=60`).
            reply(200, postList);
        await store.dispatch(Actions.getPostThread(post.id));

        const state: GlobalState = store.getState();
        const getRequest = state.requests.posts.getPostThread;
        const {
            posts,
            postsInChannel,
            postsInThread,
        } = state.entities.posts;

        if (getRequest.status === RequestStatus.FAILURE) {
            throw new Error(JSON.stringify(getRequest.error));
        }

        expect(posts).toBeTruthy();
        expect(posts[post.id]).toBeTruthy();
        expect(postsInThread[post.id]).toBeTruthy();
        expect(postsInThread[post.id]).toEqual([comment.id]);
        expect(postsInChannel[channelId]).toBeTruthy();

        const found = postsInChannel[channelId].find((block) => block.order.indexOf(comment.id) !== -1);

        // should not have found comment in postsInChannel
        expect(!found).toBeTruthy();
    });

    it('getPostEditHistory', async () => {
        const postId = TestHelper.generateId();
        const data = [{
            create_at: 1502715365009,
            edit_at: 1502715372443,
            user_id: TestHelper.basicUser!.id,
        }];

        nock(Client4.getBaseRoute()).
            get(`/posts/${postId}/edit_history`).
            reply(200, data);

        await store.dispatch(Actions.getPostEditHistory(postId));

        const state: GlobalState = store.getState();
        const editHistory = state.entities.posts.postEditHistory;

        expect(editHistory[0]).toBeTruthy();
        expect(editHistory).toEqual(data);
    });

    it('getPosts', async () => {
        const post0 = TestHelper.getPostMock({id: 'post0', channel_id: 'channel1', create_at: 1000, message: ''});
        const post1 = TestHelper.getPostMock({id: 'post1', channel_id: 'channel1', create_at: 1001, message: ''});
        const post2 = TestHelper.getPostMock({id: 'post2', channel_id: 'channel1', create_at: 1002, message: ''});
        const post3 = TestHelper.getPostMock({id: 'post3', channel_id: 'channel1', root_id: 'post2', create_at: 1003, message: '', user_id: 'user1'});
        const post4 = TestHelper.getPostMock({id: 'post4', channel_id: 'channel1', root_id: 'post0', create_at: 1004, message: '', user_id: 'user2'});

        const postList = {
            order: ['post4', 'post3', 'post2', 'post1'],
            posts: {
                post0,
                post1,
                post2,
                post3,
                post4,
            },
        };

        nock(Client4.getChannelsRoute()).
            get('/channel1/posts').
            query(true).
            reply(200, postList);

        const result = await store.dispatch(Actions.getPosts('channel1'));

        expect(result).toEqual({data: postList});

        const state: GlobalState = store.getState();

        expect(state.entities.posts.posts).toEqual({
            post0: {...post0, participants: [{id: 'user2'}]},
            post1,
            post2: {...post2, participants: [{id: 'user1'}]},
            post3,
            post4,
        });
        expect(state.entities.posts.postsInChannel).toEqual({
            channel1: [
                {order: ['post4', 'post3', 'post2', 'post1'], recent: true, oldest: false},
            ],
        });
        expect(state.entities.posts.postsInThread).toEqual({
            post0: ['post4'],
            post2: ['post3'],
        });
    });

    it('getNeededAtMentionedUsernames', async () => {
        const state = {
            entities: {
                users: {
                    profiles: {
                        1: {
                            id: '1',
                            username: 'aaa',
                        },
                    },
                },
                groups: {
                    groups: [
                        {
                            id: '1',
                            name: 'zzz',
                        },
                    ],
                },
            },
        } as unknown as GlobalState;

        expect(
            Actions.getNeededAtMentionedUsernamesAndGroups(state, [
                TestHelper.getPostMock({message: 'aaa'}),
            ])).toEqual(
            new Set(),
        );

        expect(
            Actions.getNeededAtMentionedUsernamesAndGroups(state, [
                TestHelper.getPostMock({message: '@aaa'}),
            ])).toEqual(
            new Set(),
        );

        expect(
            Actions.getNeededAtMentionedUsernamesAndGroups(state, [
                TestHelper.getPostMock({message: '@zzz'}),
            ])).toEqual(
            new Set(),
        );

        expect(
            Actions.getNeededAtMentionedUsernamesAndGroups(state, [
                TestHelper.getPostMock({message: '@aaa @bbb @ccc @zzz'}),
            ])).toEqual(
            new Set(['bbb', 'ccc']),
        );

        expect(
            Actions.getNeededAtMentionedUsernamesAndGroups(state, [
                TestHelper.getPostMock({message: '@bbb. @ccc.ddd'}),
            ])).toEqual(
            new Set(['bbb.', 'bbb', 'ccc.ddd']),
        );

        expect(
            Actions.getNeededAtMentionedUsernamesAndGroups(state, [
                TestHelper.getPostMock({message: '@bbb- @ccc-ddd'}),
            ])).toEqual(
            new Set(['bbb-', 'bbb', 'ccc-ddd']),
        );

        expect(
            Actions.getNeededAtMentionedUsernamesAndGroups(state, [
                TestHelper.getPostMock({message: '@bbb_ @ccc_ddd'}),
            ])).toEqual(
            new Set(['bbb_', 'ccc_ddd']),
        );

        expect(
            Actions.getNeededAtMentionedUsernamesAndGroups(state, [
                TestHelper.getPostMock({message: '(@bbb/@ccc) ddd@eee'}),
            ])).toEqual(
            new Set(['bbb', 'ccc']),
        );

        expect(
            Actions.getNeededAtMentionedUsernamesAndGroups(state, [
                TestHelper.getPostMock({
                    message: '@aaa @bbb',
                    props: {
                        attachments: [
                            {text: '@ccc @ddd @zzz'},
                            {pretext: '@eee @fff', text: '@ggg'},
                        ],
                    },
                }),
            ]),
        ).toEqual(
            new Set(['bbb', 'ccc', 'ddd', 'eee', 'fff', 'ggg']),
        );

        // should never try to request usernames matching special mentions
        expect(
            Actions.getNeededAtMentionedUsernamesAndGroups(state, [
                TestHelper.getPostMock({message: '@all'}),
                TestHelper.getPostMock({message: '@here'}),
                TestHelper.getPostMock({message: '@channel'}),
                TestHelper.getPostMock({message: '@all.'}),
                TestHelper.getPostMock({message: '@here.'}),
                TestHelper.getPostMock({message: '@channel.'}),
            ])).toEqual(
            new Set(),
        );
    });

    it('getPostsSince', async () => {
        const post0 = TestHelper.getPostMock({id: 'post0', channel_id: 'channel1', create_at: 1000, message: ''});
        const post1 = TestHelper.getPostMock({id: 'post1', channel_id: 'channel1', create_at: 1001, message: ''});
        const post2 = TestHelper.getPostMock({id: 'post2', channel_id: 'channel1', create_at: 1002, message: ''});
        const post3 = TestHelper.getPostMock({id: 'post3', channel_id: 'channel1', create_at: 1003, message: ''});
        const post4 = TestHelper.getPostMock({id: 'post4', channel_id: 'channel1', root_id: 'post0', create_at: 1004, message: '', user_id: 'user1'});

        store = configureStore({
            entities: {
                posts: {
                    posts: {
                        post1,
                        post2,
                    },
                    postsInChannel: {
                        channel1: [
                            {order: ['post2', 'post1'], recent: true},
                        ],
                    },
                },
            },
        });

        const postList = {
            order: ['post4', 'post3', 'post1'],
            posts: {
                post0,
                post1, // Pretend post1 has been updated
                post3,
                post4,
            },
        };

        nock(Client4.getChannelsRoute()).
            get('/channel1/posts').
            query(true).
            reply(200, postList);

        const result = await store.dispatch(Actions.getPostsSince('channel1', post2.create_at));

        expect(result).toEqual({data: postList});

        const state: GlobalState = store.getState();

        expect(state.entities.posts.posts).toEqual({
            post0: {...post0, participants: [{id: 'user1'}]},
            post1,
            post2,
            post3,
            post4,
        });
        expect(state.entities.posts.postsInChannel).toEqual({
            channel1: [
                {order: ['post4', 'post3', 'post2', 'post1'], recent: true},
            ],
        });
        expect(state.entities.posts.postsInThread).toEqual({
            post0: ['post4'],
        });
    });

    it('getPostsBefore', async () => {
        const channelId = 'channel1';

        const post1 = {id: 'post1', channel_id: channelId, create_at: 1001, message: ''};
        const post2 = {id: 'post2', channel_id: channelId, root_id: 'post1', create_at: 1002, message: ''};
        const post3 = {id: 'post3', channel_id: channelId, create_at: 1003, message: ''};

        store = configureStore({
            entities: {
                posts: {
                    posts: {
                        post3,
                    },
                    postsInChannel: {
                        channel1: [
                            {order: ['post1'], recent: false, oldest: false},
                        ],
                    },
                },
            },
        });

        const postList = {
            order: [post2.id, post1.id],
            posts: {
                post2,
                post1,
            },
            prev_post_id: '',
            next_post_id: 'post3',
        };

        nock(Client4.getChannelsRoute()).
            get(`/${channelId}/posts`).
            query(true).
            reply(200, postList);

        const result = await store.dispatch(Actions.getPostsBefore(channelId, 'post3', 0, 10));

        expect(result).toEqual({data: postList});

        const state: GlobalState = store.getState();

        expect(state.entities.posts.posts).toEqual({post1, post2, post3});
        expect(state.entities.posts.postsInChannel.channel1).toEqual([
            {order: ['post3', 'post2', 'post1'], recent: false, oldest: true},
        ]);
        expect(state.entities.posts.postsInThread).toEqual({
            post1: ['post2'],
        });
    });

    it('getPostsAfter', async () => {
        const channelId = 'channel1';

        const post1 = {id: 'post1', channel_id: channelId, create_at: 1001, message: ''};
        const post2 = {id: 'post2', channel_id: channelId, root_id: 'post1', create_at: 1002, message: '', user_id: 'user1'};
        const post3 = {id: 'post3', channel_id: channelId, create_at: 1003, message: ''};

        store = configureStore({
            entities: {
                posts: {
                    posts: {
                        post1,
                    },
                    postsInChannel: {
                        channel1: [
                            {order: ['post1'], recent: false},
                        ],
                    },
                },
            },
        });

        const postList = {
            order: [post3.id, post2.id],
            posts: {
                post2,
                post3,
            },
        };

        nock(Client4.getChannelsRoute()).
            get(`/${channelId}/posts`).
            query(true).
            reply(200, postList);

        const result = await store.dispatch(Actions.getPostsAfter(channelId, 'post1', 0, 10));

        expect(result).toEqual({data: postList});

        const state: GlobalState = store.getState();

        expect(state.entities.posts.posts).toEqual({
            post1: {...post1, participants: [{id: 'user1'}]},
            post2,
            post3,
        });
        expect(state.entities.posts.postsInChannel.channel1).toEqual([
            {order: ['post3', 'post2', 'post1'], recent: false},
        ]);
        expect(state.entities.posts.postsInThread).toEqual({
            post1: ['post2'],
        });
    });

    it('getPostsAfter with empty next_post_id', async () => {
        const channelId = 'channel1';

        const post1 = {id: 'post1', channel_id: channelId, create_at: 1001, message: ''};
        const post2 = {id: 'post2', channel_id: channelId, root_id: 'post1', create_at: 1002, message: '', user_id: 'user1'};
        const post3 = {id: 'post3', channel_id: channelId, create_at: 1003, message: ''};

        store = configureStore({
            entities: {
                posts: {
                    posts: {
                        post1,
                    },
                    postsInChannel: {
                        channel1: [
                            {order: ['post1'], recent: false},
                        ],
                    },
                },
            },
        });

        const postList = {
            order: [post3.id, post2.id],
            posts: {
                post2,
                post3,
            },
            next_post_id: '',
        };

        nock(Client4.getChannelsRoute()).
            get(`/${channelId}/posts`).
            query(true).
            reply(200, postList);

        const result = await store.dispatch(Actions.getPostsAfter(channelId, 'post1', 0, 10));

        expect(result).toEqual({data: postList});

        const state: GlobalState = store.getState();

        expect(state.entities.posts.posts).toEqual({
            post1: {...post1, participants: [{id: 'user1'}]},
            post2,
            post3,
        });
        expect(state.entities.posts.postsInChannel.channel1).toEqual([
            {order: ['post3', 'post2', 'post1'], recent: true},
        ]);
    });

    it('getPostsAround', async () => {
        const postId = 'post3';
        const channelId = 'channel1';

        const postsAfter = {
            posts: {
                post1: {id: 'post1', create_at: 10002, message: ''},
                post2: {id: 'post2', create_at: 10001, message: ''},
            },
            order: ['post1', 'post2'],
            next_post_id: 'post0',
            before_post_id: 'post3',
        };
        const postsThread = {
            posts: {
                root: {id: 'root', create_at: 10010, message: ''},
                post3: {id: 'post3', root_id: 'root', create_at: 10000, message: ''},
            },
            order: ['post3'],
            next_post_id: 'post2',
            before_post_id: 'post5',
        };
        const postsBefore = {
            posts: {
                post4: {id: 'post4', create_at: 9999, message: ''},
                post5: {id: 'post5', create_at: 9998, message: ''},
            },
            order: ['post4', 'post5'],
            next_post_id: 'post3',
            prev_post_id: 'post6',
        };

        nock(Client4.getChannelsRoute()).
            get(`/${channelId}/posts`).
            query((params) => Boolean(params.after)).
            reply(200, postsAfter);
        nock(Client4.getChannelsRoute()).
            get(`/${channelId}/posts`).
            query((params) => Boolean(params.before)).
            reply(200, postsBefore);
        nock(Client4.getBaseRoute()).
            get(`/posts/${postId}/thread`).
            query(true).
            reply(200, postsThread);

        const result = await store.dispatch(Actions.getPostsAround(channelId, postId));

        expect(result.error).toBeFalsy();
        expect(result.data).toEqual({
            posts: {
                ...postsAfter.posts,
                ...postsThread.posts,
                ...postsBefore.posts,
            },
            order: [
                ...postsAfter.order,
                postId,
                ...postsBefore.order,
            ],
            next_post_id: postsAfter.next_post_id,
            prev_post_id: postsBefore.prev_post_id,
            first_inaccessible_post_time: 0,
        });

        const {posts, postsInChannel, postsInThread} = store.getState().entities.posts;

        // should store all of the posts
        expect(posts).toHaveProperty('post1');
        expect(posts).toHaveProperty('post2');
        expect(posts).toHaveProperty('post3');
        expect(posts).toHaveProperty('post4');
        expect(posts).toHaveProperty('post5');
        expect(posts).toHaveProperty('root');

        // should only store the posts that we know the order of
        expect(postsInChannel[channelId]).toEqual([{order: ['post1', 'post2', 'post3', 'post4', 'post5'], recent: false, oldest: false}]);

        // should populate postsInThread
        expect(postsInThread.root).toEqual(['post3']);
    });

    it('flagPost', async () => {
        const {dispatch, getState} = store;
        const channelId = TestHelper.basicChannel!.id;

        nock(Client4.getUsersRoute()).
            post('/logout').
            reply(200, OK_RESPONSE);
        await TestHelper.basicClient4!.logout();

        TestHelper.mockLogin();
        store.dispatch({
            type: UserTypes.LOGIN_SUCCESS,
        });
        await store.dispatch(loadMe());

        nock(Client4.getBaseRoute()).
            post('/posts').
            reply(201, TestHelper.fakePostWithId(TestHelper.basicChannel!.id));

        const post1 = await Client4.createPost(
            TestHelper.fakePost(channelId),
        );

        nock(Client4.getUsersRoute()).
            put(`/${TestHelper.basicUser!.id}/preferences`).
            reply(200, OK_RESPONSE);

        dispatch(Actions.flagPost(post1.id));
        const state = getState();
        const prefKey = getPreferenceKey(Preferences.CATEGORY_FLAGGED_POST, post1.id);
        const preference = state.entities.preferences.myPreferences[prefKey];
        expect(preference).toBeTruthy();
    });

    it('unflagPost', async () => {
        const {dispatch, getState} = store;
        const channelId = TestHelper.basicChannel!.id;
        nock(Client4.getUsersRoute()).
            post('/logout').
            reply(200, OK_RESPONSE);
        await TestHelper.basicClient4!.logout();

        TestHelper.mockLogin();
        store.dispatch({
            type: UserTypes.LOGIN_SUCCESS,
        });
        await store.dispatch(loadMe());

        nock(Client4.getBaseRoute()).
            post('/posts').
            reply(201, TestHelper.fakePostWithId(TestHelper.basicChannel!.id));
        const post1 = await Client4.createPost(
            TestHelper.fakePost(channelId),
        );

        nock(Client4.getUsersRoute()).
            put(`/${TestHelper.basicUser!.id}/preferences`).
            reply(200, OK_RESPONSE);
        dispatch(Actions.flagPost(post1.id));
        let state = getState();
        const prefKey = getPreferenceKey(Preferences.CATEGORY_FLAGGED_POST, post1.id);
        const preference = state.entities.preferences.myPreferences[prefKey];
        expect(preference).toBeTruthy();

        nock(Client4.getUsersRoute()).
            delete(`/${TestHelper.basicUser!.id}/preferences`).
            reply(200, OK_RESPONSE);
        dispatch(Actions.unflagPost(post1.id));
        state = getState();
        const unflagged = state.entities.preferences.myPreferences[prefKey];
        if (unflagged) {
            throw new Error('unexpected unflagged');
        }
    });

    it('setUnreadPost', async () => {
        const teamId = TestHelper.generateId();
        const channelId = TestHelper.generateId();
        const userId = TestHelper.generateId();
        const postId = TestHelper.generateId();

        store = configureStore({
            entities: {
                channels: {
                    channels: {
                        [channelId]: {team_id: teamId},
                    },
                    messageCounts: {
                        [channelId]: {total: 10},
                    },
                    myMembers: {
                        [channelId]: {msg_count: 10, mention_count: 0, last_viewed_at: 0},
                    },
                },
                teams: {
                    myMembers: {
                        [teamId]: {msg_count: 15, mention_count: 0},
                    },
                },
                users: {
                    currentUserId: userId,
                },
                posts: {
                    posts: {
                        [postId]: {id: postId, msg: 'test message', create_at: 123, delete_at: 0, channel_id: channelId},
                    },
                },
            },
        });

        nock(Client4.getUserRoute(userId)).post(`/posts/${postId}/set_unread`).reply(200, {
            team_id: teamId,
            channel_id: channelId,
            msg_count: 3,
            last_viewed_at: 1565605543,
            mention_count: 1,
        });

        await store.dispatch(Actions.setUnreadPost(userId, postId));
        const state: GlobalState = store.getState();

        expect(state.entities.channels.messageCounts[channelId].total).toBe(10);
        expect(state.entities.channels.myMembers[channelId].msg_count).toBe(3);
        expect(state.entities.channels.myMembers[channelId].mention_count).toBe(1);
        expect(state.entities.channels.myMembers[channelId].last_viewed_at).toBe(1565605543);
        expect(state.entities.teams.myMembers[teamId].msg_count).toBe(8);
        expect(state.entities.teams.myMembers[teamId].mention_count).toBe(1);
    });

    describe('pinPost', () => {
        test('should update post and channel stats', async () => {
            nock(Client4.getBaseRoute()).
                get(`/channels/${TestHelper.basicChannel!.id}/stats?exclude_files_count=true`).
                reply(200, {channel_id: TestHelper.basicChannel!.id, member_count: 1, pinnedpost_count: 0});
            await store.dispatch(getChannelStats(TestHelper.basicChannel!.id));

            const post = TestHelper.fakePostWithId(TestHelper.basicChannel!.id);
            store.dispatch(Actions.receivedPost(post));

            nock(Client4.getBaseRoute()).
                post(`/posts/${post.id}/pin`).
                reply(200, OK_RESPONSE);

            const result = await store.dispatch(Actions.pinPost(post.id));
            expect(result.error).toBeUndefined();

            const state = store.getState();
            expect(state.entities.posts.posts[post.id].is_pinned).toBe(true);
            expect(state.entities.channels.stats[TestHelper.basicChannel!.id].pinnedpost_count).toBe(1);
        });

        test('MM-14115 should not clobber reactions on pinned post', async () => {
            const post = TestHelper.getPostMock({
                id: TestHelper.generateId(),
                metadata: {
                    embeds: [],
                    emojis: [],
                    files: [],
                    images: {},
                    reactions: [
                        TestHelper.getReactionMock({emoji_name: 'test'}),
                    ],
                },
            });

            store.dispatch(Actions.receivedPost(post));

            let state = store.getState();
            expect(state.entities.posts.posts[post.id].is_pinned).toBe(false);
            expect(Object.keys(state.entities.posts.reactions[post.id])).toHaveLength(1);

            nock(Client4.getBaseRoute()).
                post(`/posts/${post.id}/pin`).
                reply(200, OK_RESPONSE);

            const result = await store.dispatch(Actions.pinPost(post.id));
            expect(result.error).toBeUndefined();

            state = store.getState();
            expect(state.entities.posts.posts[post.id].is_pinned).toBe(true);
            expect(Object.keys(state.entities.posts.reactions[post.id])).toHaveLength(1);
        });
    });

    describe('unpinPost', () => {
        test('should update post and channel stats', async () => {
            nock(Client4.getBaseRoute()).
                get(`/channels/${TestHelper.basicChannel!.id}/stats?exclude_files_count=true`).
                reply(200, {channel_id: TestHelper.basicChannel!.id, member_count: 1, pinnedpost_count: 1});
            await store.dispatch(getChannelStats(TestHelper.basicChannel!.id));

            const post = TestHelper.fakePostWithId(TestHelper.basicChannel!.id);
            store.dispatch(Actions.receivedPost(post));

            nock(Client4.getBaseRoute()).
                post(`/posts/${post.id}/unpin`).
                reply(200, OK_RESPONSE);

            const result = await store.dispatch(Actions.unpinPost(post.id));
            expect(result.error).toBeUndefined();

            const state = store.getState();
            expect(state.entities.posts.posts[post.id].is_pinned).toBe(false);
            expect(state.entities.channels.stats[TestHelper.basicChannel!.id].pinnedpost_count).toBe(0);
        });

        test('MM-14115 should not clobber reactions on pinned post', async () => {
            const post = TestHelper.getPostMock({
                id: TestHelper.generateId(),
                is_pinned: true,
                metadata: {
                    embeds: [],
                    emojis: [],
                    files: [],
                    images: {},
                    reactions: [
                        TestHelper.getReactionMock({emoji_name: 'test'}),
                    ],
                },
            });

            store.dispatch(Actions.receivedPost(post));

            let state = store.getState();
            expect(state.entities.posts.posts[post.id].is_pinned).toBe(true);
            expect(Object.keys(state.entities.posts.reactions[post.id])).toHaveLength(1);

            nock(Client4.getBaseRoute()).
                post(`/posts/${post.id}/unpin`).
                reply(200, OK_RESPONSE);

            const result = await store.dispatch(Actions.unpinPost(post.id));
            expect(result.error).toBeUndefined();

            state = store.getState();
            expect(state.entities.posts.posts[post.id].is_pinned).toBe(false);
            expect(Object.keys(state.entities.posts.reactions[post.id])).toHaveLength(1);
        });
    });

    it('addReaction', async () => {
        const {dispatch, getState} = store;

        TestHelper.mockLogin();
        store.dispatch({
            type: UserTypes.LOGIN_SUCCESS,
        });
        await store.dispatch(loadMe());

        nock(Client4.getBaseRoute()).
            post('/posts').
            reply(201, TestHelper.fakePostWithId(TestHelper.basicChannel!.id));
        const post1 = await Client4.createPost(
            TestHelper.fakePost(TestHelper.basicChannel!.id),
        );

        const emojiName = '+1';

        nock(Client4.getBaseRoute()).
            post('/reactions').
            reply(201, {user_id: TestHelper.basicUser!.id, post_id: post1.id, emoji_name: emojiName, create_at: 1508168444721});
        await dispatch(Actions.addReaction(post1.id, emojiName));

        const state = getState();
        const reactions = state.entities.posts.reactions[post1.id];
        expect(reactions).toBeTruthy();
        expect(reactions[TestHelper.basicUser!.id + '-' + emojiName]).toBeTruthy();
    });

    it('removeReaction', async () => {
        const {dispatch, getState} = store;

        TestHelper.mockLogin();
        store.dispatch({
            type: UserTypes.LOGIN_SUCCESS,
        });
        await store.dispatch(loadMe());

        nock(Client4.getBaseRoute()).
            post('/posts').
            reply(201, TestHelper.fakePostWithId(TestHelper.basicChannel!.id));
        const post1 = await Client4.createPost(
            TestHelper.fakePost(TestHelper.basicChannel!.id),
        );

        const emojiName = '+1';

        nock(Client4.getBaseRoute()).
            post('/reactions').
            reply(201, {user_id: TestHelper.basicUser!.id, post_id: post1.id, emoji_name: emojiName, create_at: 1508168444721});
        await dispatch(Actions.addReaction(post1.id, emojiName));

        nock(Client4.getUsersRoute()).
            delete(`/${TestHelper.basicUser!.id}/posts/${post1.id}/reactions/${emojiName}`).
            reply(200, OK_RESPONSE);
        await dispatch(Actions.removeReaction(post1.id, emojiName));

        const state = getState();
        const reactions = state.entities.posts.reactions[post1.id];
        expect(reactions).toBeTruthy();
        expect(!reactions[TestHelper.basicUser!.id + '-' + emojiName]).toBeTruthy();
    });

    it('getCustomEmojiForReaction', async () => {
        const testImageData = fs.createReadStream('src/packages/mattermost-redux/test/assets/images/test.png');
        const {dispatch, getState} = store;

        nock(Client4.getBaseRoute()).
            post('/emoji').
            reply(201, {id: TestHelper.generateId(), create_at: 1507918415696, update_at: 1507918415696, delete_at: 0, creator_id: TestHelper.basicUser!.id, name: TestHelper.generateId()});

        const {data: created} = await dispatch(createCustomEmoji(
            {
                name: TestHelper.generateId(),
                creator_id: TestHelper.basicUser!.id,
            },
            testImageData,
        ));

        nock(Client4.getEmojisRoute()).
            get(`/name/${created.name}`).
            reply(200, created);

        const missingEmojiName = ':notrealemoji:';

        nock(Client4.getEmojisRoute()).
            get(`/name/${missingEmojiName}`).
            reply(404, {message: 'Not found', status_code: 404});

        await dispatch(Actions.getCustomEmojiForReaction(missingEmojiName));

        const state = getState();
        const emojis = state.entities.emojis.customEmoji;
        expect(emojis).toBeTruthy();
        expect(emojis[created.id]).toBeTruthy();
        expect(state.entities.emojis.nonExistentEmoji.has(missingEmojiName)).toBeTruthy();
    });

    it('doPostAction', async () => {
        nock(Client4.getBaseRoute()).
            post('/posts/posth67ja7ntdkek6g13dp3wka/actions/action7ja7ntdkek6g13dp3wka').
            reply(200, {});

        const {data} = await store.dispatch(Actions.doPostAction('posth67ja7ntdkek6g13dp3wka', 'action7ja7ntdkek6g13dp3wka', 'option'));
        expect(data).toEqual({});
    });

    it('doPostActionWithCookie', async () => {
        nock(Client4.getBaseRoute()).
            post('/posts/posth67ja7ntdkek6g13dp3wka/actions/action7ja7ntdkek6g13dp3wka').
            reply(200, {});

        const {data} = await store.dispatch(Actions.doPostActionWithCookie('posth67ja7ntdkek6g13dp3wka', 'action7ja7ntdkek6g13dp3wka', '', 'option'));
        expect(data).toEqual({});
    });

    it('addMessageIntoHistory', async () => {
        const {dispatch, getState} = store;

        await dispatch(Actions.addMessageIntoHistory('test1'));

        let history = getState().entities.posts.messagesHistory.messages;
        expect(history.length === 1).toBeTruthy();
        expect(history[0] === 'test1').toBeTruthy();

        await dispatch(Actions.addMessageIntoHistory('test2'));

        history = getState().entities.posts.messagesHistory.messages;
        expect(history.length === 2).toBeTruthy();
        expect(history[1] === 'test2').toBeTruthy();

        await dispatch(Actions.addMessageIntoHistory('test3'));

        history = getState().entities.posts.messagesHistory.messages;
        expect(history.length === 3).toBeTruthy();
        expect(history[2] === 'test3').toBeTruthy();
    });

    it('resetHistoryIndex', async () => {
        const {dispatch, getState} = store;

        await dispatch(Actions.addMessageIntoHistory('test1'));
        await dispatch(Actions.addMessageIntoHistory('test2'));
        await dispatch(Actions.addMessageIntoHistory('test3'));

        let index = getState().entities.posts.messagesHistory.index[Posts.MESSAGE_TYPES.POST];
        expect(index === 3).toBeTruthy();
        index = getState().entities.posts.messagesHistory.index[Posts.MESSAGE_TYPES.COMMENT];
        expect(index === 3).toBeTruthy();

        await dispatch(Actions.moveHistoryIndexBack(Posts.MESSAGE_TYPES.POST));
        await dispatch(Actions.moveHistoryIndexBack(Posts.MESSAGE_TYPES.POST));
        await dispatch(Actions.moveHistoryIndexBack(Posts.MESSAGE_TYPES.COMMENT));

        index = getState().entities.posts.messagesHistory.index[Posts.MESSAGE_TYPES.POST];
        expect(index === 1).toBeTruthy();
        index = getState().entities.posts.messagesHistory.index[Posts.MESSAGE_TYPES.COMMENT];
        expect(index === 2).toBeTruthy();

        await dispatch(Actions.resetHistoryIndex(Posts.MESSAGE_TYPES.POST));

        index = getState().entities.posts.messagesHistory.index[Posts.MESSAGE_TYPES.POST];
        expect(index === 3).toBeTruthy();
        index = getState().entities.posts.messagesHistory.index[Posts.MESSAGE_TYPES.COMMENT];
        expect(index === 2).toBeTruthy();

        await dispatch(Actions.resetHistoryIndex(Posts.MESSAGE_TYPES.COMMENT));

        index = getState().entities.posts.messagesHistory.index[Posts.MESSAGE_TYPES.POST];
        expect(index === 3).toBeTruthy();
        index = getState().entities.posts.messagesHistory.index[Posts.MESSAGE_TYPES.COMMENT];
        expect(index === 3).toBeTruthy();
    });

    it('moveHistoryIndexBack', async () => {
        const {dispatch, getState} = store;

        await dispatch(Actions.moveHistoryIndexBack(Posts.MESSAGE_TYPES.POST));

        let index = getState().entities.posts.messagesHistory.index[Posts.MESSAGE_TYPES.POST];
        expect(index === -1).toBeTruthy();

        await dispatch(Actions.moveHistoryIndexBack(Posts.MESSAGE_TYPES.POST));

        index = getState().entities.posts.messagesHistory.index[Posts.MESSAGE_TYPES.POST];
        expect(index === -1).toBeTruthy();

        await dispatch(Actions.addMessageIntoHistory('test1'));
        await dispatch(Actions.addMessageIntoHistory('test2'));
        await dispatch(Actions.addMessageIntoHistory('test3'));

        index = getState().entities.posts.messagesHistory.index[Posts.MESSAGE_TYPES.POST];
        expect(index === 3).toBeTruthy();
        index = getState().entities.posts.messagesHistory.index[Posts.MESSAGE_TYPES.COMMENT];
        expect(index === 3).toBeTruthy();

        await dispatch(Actions.moveHistoryIndexBack(Posts.MESSAGE_TYPES.POST));
        await dispatch(Actions.moveHistoryIndexBack(Posts.MESSAGE_TYPES.POST));

        index = getState().entities.posts.messagesHistory.index[Posts.MESSAGE_TYPES.POST];
        expect(index === 1).toBeTruthy();
        index = getState().entities.posts.messagesHistory.index[Posts.MESSAGE_TYPES.COMMENT];
        expect(index === 3).toBeTruthy();

        await dispatch(Actions.moveHistoryIndexBack(Posts.MESSAGE_TYPES.POST));
        await dispatch(Actions.moveHistoryIndexBack(Posts.MESSAGE_TYPES.POST));

        index = getState().entities.posts.messagesHistory.index[Posts.MESSAGE_TYPES.POST];
        expect(index === 0).toBeTruthy();
        index = getState().entities.posts.messagesHistory.index[Posts.MESSAGE_TYPES.COMMENT];
        expect(index === 3).toBeTruthy();

        await dispatch(Actions.moveHistoryIndexBack(Posts.MESSAGE_TYPES.COMMENT));

        index = getState().entities.posts.messagesHistory.index[Posts.MESSAGE_TYPES.POST];
        expect(index === 0).toBeTruthy();
        index = getState().entities.posts.messagesHistory.index[Posts.MESSAGE_TYPES.COMMENT];
        expect(index === 2).toBeTruthy();
    });

    it('moveHistoryIndexForward', async () => {
        const {dispatch, getState} = store;

        await dispatch(Actions.moveHistoryIndexForward(Posts.MESSAGE_TYPES.POST));

        let index = getState().entities.posts.messagesHistory.index[Posts.MESSAGE_TYPES.POST];
        expect(index === 0).toBeTruthy();

        await dispatch(Actions.moveHistoryIndexForward(Posts.MESSAGE_TYPES.POST));

        index = getState().entities.posts.messagesHistory.index[Posts.MESSAGE_TYPES.POST];
        expect(index === 0).toBeTruthy();

        await dispatch(Actions.addMessageIntoHistory('test1'));
        await dispatch(Actions.addMessageIntoHistory('test2'));
        await dispatch(Actions.addMessageIntoHistory('test3'));

        index = getState().entities.posts.messagesHistory.index[Posts.MESSAGE_TYPES.POST];
        expect(index === 3).toBeTruthy();
        index = getState().entities.posts.messagesHistory.index[Posts.MESSAGE_TYPES.COMMENT];
        expect(index === 3).toBeTruthy();

        await dispatch(Actions.moveHistoryIndexForward(Posts.MESSAGE_TYPES.POST));
        await dispatch(Actions.moveHistoryIndexForward(Posts.MESSAGE_TYPES.POST));

        index = getState().entities.posts.messagesHistory.index[Posts.MESSAGE_TYPES.POST];
        expect(index === 3).toBeTruthy();
        index = getState().entities.posts.messagesHistory.index[Posts.MESSAGE_TYPES.COMMENT];
        expect(index === 3).toBeTruthy();

        await dispatch(Actions.moveHistoryIndexBack(Posts.MESSAGE_TYPES.POST));
        await dispatch(Actions.moveHistoryIndexBack(Posts.MESSAGE_TYPES.POST));
        await dispatch(Actions.moveHistoryIndexBack(Posts.MESSAGE_TYPES.COMMENT));
        await dispatch(Actions.moveHistoryIndexBack(Posts.MESSAGE_TYPES.COMMENT));

        index = getState().entities.posts.messagesHistory.index[Posts.MESSAGE_TYPES.POST];
        expect(index === 1).toBeTruthy();
        index = getState().entities.posts.messagesHistory.index[Posts.MESSAGE_TYPES.COMMENT];
        expect(index === 1).toBeTruthy();

        await dispatch(Actions.moveHistoryIndexForward(Posts.MESSAGE_TYPES.POST));

        index = getState().entities.posts.messagesHistory.index[Posts.MESSAGE_TYPES.POST];
        expect(index === 2).toBeTruthy();
        index = getState().entities.posts.messagesHistory.index[Posts.MESSAGE_TYPES.COMMENT];
        expect(index === 1).toBeTruthy();

        await dispatch(Actions.moveHistoryIndexForward(Posts.MESSAGE_TYPES.COMMENT));

        index = getState().entities.posts.messagesHistory.index[Posts.MESSAGE_TYPES.POST];
        expect(index === 2).toBeTruthy();
        index = getState().entities.posts.messagesHistory.index[Posts.MESSAGE_TYPES.COMMENT];
        expect(index === 2).toBeTruthy();
    });

    describe('getMentionsAndStatusesForPosts', () => {
        describe('different values for posts argument', () => {
            // Mock the state to prevent any followup requests since we aren't testing those
            const currentUserId = 'user';
            const post = TestHelper.getPostMock({id: 'post', user_id: currentUserId, message: 'This is a post'});

            const dispatch = null;
            const getState = (() => ({
                entities: {
                    general: {
                        config: {
                            EnableCustomEmoji: 'false',
                        },
                    },
                    users: {
                        currentUserId,
                        statuses: {
                            [currentUserId]: 'status',
                        },
                    },
                },
            })) as unknown as GetStateFunc;

            it('null', async () => {
                await Actions.getMentionsAndStatusesForPosts(null as any, dispatch as any, getState);
            });

            it('array of posts', async () => {
                const posts = [post];

                await Actions.getMentionsAndStatusesForPosts(posts, dispatch as any, getState);
            });

            it('object map of posts', async () => {
                const posts = {
                    [post.id]: post,
                };

                await Actions.getMentionsAndStatusesForPosts(posts, dispatch as any, getState);
            });
        });
    });

    describe('receivedPostsBefore', () => {
        it('Should return default false for oldest key if param does not exist', () => {
            const posts = {} as PostList;
            const result = Actions.receivedPostsBefore(posts, 'channelId', 'beforePostId');
            expect(result).toEqual({
                type: PostTypes.RECEIVED_POSTS_BEFORE,
                channelId: 'channelId',
                data: posts,
                beforePostId: 'beforePostId',
                oldest: false,
            });
        });

        it('Should return true for oldest key', () => {
            const posts = {} as PostList;
            const result = Actions.receivedPostsBefore(posts, 'channelId', 'beforePostId', true);
            expect(result).toEqual({
                type: PostTypes.RECEIVED_POSTS_BEFORE,
                channelId: 'channelId',
                data: posts,
                beforePostId: 'beforePostId',
                oldest: true,
            });
        });
    });

    describe('receivedPostsInChannel', () => {
        it('Should return default false for both recent and oldest keys if params dont exist', () => {
            const posts = {} as PostList;
            const result = Actions.receivedPostsInChannel(posts, 'channelId');
            expect(result).toEqual({
                type: PostTypes.RECEIVED_POSTS_IN_CHANNEL,
                channelId: 'channelId',
                data: posts,
                recent: false,
                oldest: false,
            });
        });

        it('Should return true for oldest and recent keys', () => {
            const posts = {} as PostList;
            const result = Actions.receivedPostsInChannel(posts, 'channelId', true, true);
            expect(result).toEqual({
                type: PostTypes.RECEIVED_POSTS_IN_CHANNEL,
                channelId: 'channelId',
                data: posts,
                recent: true,
                oldest: true,
            });
        });
    });
});

describe('getPostThreads', () => {
    beforeAll(() => {
        TestHelper.initBasic(Client4);
    });

    afterAll(() => {
        TestHelper.tearDown();
    });

    const channelId = 'currentChannelId';
    const initialState = {
        entities: {
            channels: {
                currentChannelId: channelId,
            },
            users: {
                currentUserId: 'currentUserId',
                statuses: {},
                profiles: {},
            },
            general: {
                config: {},
            },
            posts: {
                posts: {},
            },
            preferences: {
                myPreferences: {},
            },
        },
    };

    const post1 = TestHelper.getPostMock({id: TestHelper.generateId(), channel_id: channelId, message: '', user_id: 'currentUserId'});
    const comment = TestHelper.getPostMock({id: TestHelper.generateId(), root_id: post1.id, channel_id: channelId, message: '', user_id: 'currentUserId'});

    it('handles null', async () => {
        const testStore = await mockStore(initialState);
        const ret = await testStore.dispatch(Actions.getPostThreads(null as any));
        expect(ret).toEqual({data: true});

        expect(testStore.getActions()).toEqual([]);
    });

    it('pulls up the thread of missing root post in the same channel', async () => {
        const testStore = await mockStore(initialState);
        nock(Client4.getBaseRoute()).
            get(`/posts/${post1.id}/thread?skipFetchThreads=false&collapsedThreads=false&collapsedThreadsExtended=false&direction=down&perPage=60`).
            reply(200, {
                order: [post1.id],
                posts: {
                    [post1.id]: post1,
                    [comment.id]: comment,
                },
            });

        await testStore.dispatch(Actions.getPostThreads([comment]));

        expect(testStore.getActions()[0].payload[0].type).toEqual('RECEIVED_POSTS');
        expect(testStore.getActions()[0].payload[0].data.posts).toEqual({
            [post1.id]: post1,
            [comment.id]: comment,
        });

        expect(testStore.getActions()[0].payload[1].type).toEqual('RECEIVED_POSTS_IN_THREAD');
        expect(testStore.getActions()[0].payload[1].rootId).toEqual(post1.id);
        expect(testStore.getActions()[0].payload[1].data.posts).toEqual({
            [post1.id]: post1,
            [comment.id]: comment,
        });
    });
});
