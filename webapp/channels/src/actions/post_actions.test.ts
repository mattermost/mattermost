// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Post} from '@mattermost/types/posts';
import {FileInfo} from '@mattermost/types/files';

import {GlobalState} from 'types/store';
import {ChannelTypes, SearchTypes} from 'mattermost-redux/action_types';
import * as PostActions from 'mattermost-redux/actions/posts';
import {Posts} from 'mattermost-redux/constants';

import * as Actions from 'actions/post_actions';
import {Constants, ActionTypes, RHSStates} from 'utils/constants';

import mockStore from 'tests/test_store';

jest.mock('mattermost-redux/actions/posts', () => ({
    addReaction: (...args: any[]) => ({type: 'MOCK_ADD_REACTION', args}),
    createPost: (...args: any[]) => ({type: 'MOCK_CREATE_POST', args}),
    createPostImmediately: (...args: any[]) => ({type: 'MOCK_CREATE_POST_IMMEDIATELY', args}),
    flagPost: (...args: any[]) => ({type: 'MOCK_FLAG_POST', args}),
    unflagPost: (...args: any[]) => ({type: 'MOCK_UNFLAG_POST', args}),
    pinPost: (...args: any[]) => ({type: 'MOCK_PIN_POST', args}),
    unpinPost: (...args: any[]) => ({type: 'MOCK_UNPIN_POST', args}),
    receivedNewPost: (...args: any[]) => ({type: 'MOCK_RECEIVED_NEW_POST', args}),
}));

jest.mock('actions/emoji_actions', () => ({
    addRecentEmoji: (...args: any[]) => ({type: 'MOCK_ADD_RECENT_EMOJI', args}),
    addRecentEmojis: (...args: any[]) => ({type: 'MOCK_ADD_RECENT_EMOJIS', args}),
}));

jest.mock('actions/notification_actions', () => ({
    sendDesktopNotification: jest.fn().mockReturnValue({type: 'MOCK_SEND_DESKTOP_NOTIFICATION'}),
}));

jest.mock('actions/storage', () => {
    const original = jest.requireActual('actions/storage');
    return {
        ...original,
        setGlobalItem: (...args: any[]) => ({type: 'MOCK_SET_GLOBAL_ITEM', args}),
    };
});

jest.mock('utils/user_agent', () => ({
    isIosClassic: jest.fn().mockReturnValueOnce(true).mockReturnValue(false),
    isDesktopApp: jest.fn().mockReturnValue(false),
}));

const POST_CREATED_TIME = Date.now();

// This mocks the Date.now() function so it returns a constant value
global.Date.now = jest.fn(() => POST_CREATED_TIME);

const INCREASED_POST_VISIBILITY = {amount: 1, data: 'current_channel_id', type: 'INCREASE_POST_VISIBILITY'};

describe('Actions.Posts', () => {
    const latestPost = {
        id: 'latest_post_id',
        user_id: 'current_user_id',
        message: 'test msg',
        channel_id: 'current_channel_id',
        type: 'normal,',
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
                myMembers: {
                    [latestPost.channel_id]: {
                        channel_id: 'current_channel_id',
                        user_id: 'current_user_id',
                        roles: 'channel_role',
                    },
                    other_channel_id: {
                        channel_id: 'other_channel_id',
                        user_id: 'current_user_id',
                        roles: 'channel_role',
                    },
                },
                roles: {
                    [latestPost.channel_id]: [
                        'current_channel_id',
                        'current_user_id',
                        'channel_role',
                    ],
                    other_channel_id: [
                        'other_channel_id',
                        'current_user_id',
                        'channel_role',
                    ],
                },
                channels: {
                    current_channel_id: {team_a: 'team_a', id: 'current_channel_id'},
                },
                manuallyUnread: {},
            },
            preferences: {
                myPreferences: {
                    'display_settings--name_format': {
                        category: 'display_settings',
                        name: 'name_format',
                        user_id: 'current_user_id',
                        value: 'username',
                    },
                },
            },
            teams: {
                currentTeamId: 'team-a',
                teams: {
                    team_a: {
                        id: 'team_a',
                        name: 'team-a',
                        displayName: 'Team A',
                    },
                    team_b: {
                        id: 'team_b',
                        name: 'team-a',
                        displayName: 'Team B',
                    },
                },
                myMembers: {
                    'team-a': {roles: 'team_role'},
                    'team-b': {roles: 'team_role'},
                },
            },
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    current_user_id: {
                        id: 'current_user_id',
                        username: 'current_username',
                        roles: 'system_role',
                        useAutomaticTimezone: true,
                        automaticTimezone: '',
                        manualTimezone: '',
                    },
                },
            },
            general: {
                license: {IsLicensed: 'false'},
                serverVersion: '5.4.0',
                config: {PostEditTimeLimit: -1},
            },
            roles: {
                roles: {
                    system_role: {
                        permissions: ['edit_post'],
                    },
                    team_role: {
                        permissions: [],
                    },
                    channel_role: {
                        permissions: [],
                    },
                },
            },
            emojis: {customEmoji: {}},
            search: {results: []},
        },
        views: {
            posts: {
                editingPost: {},
            },
            rhs: {
                searchTerms: '',
                filesSearchExtFilter: [],
            },
        },
    } as unknown as GlobalState;

    test('handleNewPost', async () => {
        const testStore = mockStore(initialState);
        const newPost = {id: 'new_post_id', channel_id: 'current_channel_id', message: 'new message', type: Constants.PostTypes.ADD_TO_CHANNEL, user_id: 'some_user_id', create_at: POST_CREATED_TIME} as Post;
        const msg = {data: {team_a: 'team_a', mentions: ['current_user_id']}};

        await testStore.dispatch(Actions.handleNewPost(newPost, msg as any));
        expect(testStore.getActions()).toEqual([
            {
                meta: {batch: true},
                payload: [
                    INCREASED_POST_VISIBILITY,
                    PostActions.receivedNewPost(newPost, false),
                ],
                type: 'BATCHING_REDUCER.BATCH',
            },
            {
                type: 'MOCK_SEND_DESKTOP_NOTIFICATION',
            },
        ]);
    });

    test('handleNewPostOtherChannel', async () => {
        const testStore = mockStore(initialState);
        const newPost = {id: 'other_channel_post_id', channel_id: 'other_channel_id', message: 'new message in other channel', type: '', user_id: 'other_user_id', create_at: POST_CREATED_TIME} as Post;
        const msg = {data: {team_b: 'team_b', mentions: ['current_user_id']}};

        await testStore.dispatch(Actions.handleNewPost(newPost, msg as any));
        expect(testStore.getActions()).toEqual([
            {
                meta: {batch: true},
                payload: [
                    PostActions.receivedNewPost(newPost, false),
                    {
                        type: ChannelTypes.INCREMENT_UNREAD_MSG_COUNT,
                        data: {
                            amount: 1,
                            amountRoot: 0,
                            channelId: 'other_channel_id',
                            fetchedChannelMember: false,
                            onlyMentions: undefined,
                            teamId: undefined,
                        },
                    },
                    {
                        type: ChannelTypes.INCREMENT_TOTAL_MSG_COUNT,
                        data: {
                            amount: 1,
                            amountRoot: 0,
                            channelId: 'other_channel_id',
                        },
                    },
                    {
                        type: ChannelTypes.INCREMENT_UNREAD_MENTION_COUNT,
                        data: {
                            amount: 1,
                            amountRoot: 0,
                            amountUrgent: 0,
                            channelId: 'other_channel_id',
                            fetchedChannelMember: false,
                            teamId: undefined,
                        },
                    },
                ],
                type: 'BATCHING_REDUCER.BATCH',
            },
            {
                type: 'MOCK_SEND_DESKTOP_NOTIFICATION',
            },
        ]);
    });

    test('unsetEditingPost', async () => {
        // should allow to edit and should fire an action
        const testStore = mockStore({...initialState});
        const {data: dataSet} = await testStore.dispatch((Actions.setEditingPost as any)('latest_post_id', 'test', 'title'));
        expect(dataSet).toEqual(true);

        // matches the action to set editingPost
        expect(testStore.getActions()).toEqual(
            [{data: {isRHS: false, postId: 'latest_post_id', refocusId: 'test', title: 'title', show: true}, type: ActionTypes.TOGGLE_EDITING_POST}],
        );

        // clear actions
        testStore.clearActions();

        // dispatch action to unset the editingPost
        const {data: dataUnset} = testStore.dispatch(Actions.unsetEditingPost());
        expect(dataUnset).toEqual({show: false});

        // matches the action to unset editingPost
        expect(testStore.getActions()).toEqual(
            [{data: {show: false}, type: ActionTypes.TOGGLE_EDITING_POST}],
        );

        // editingPost value is empty object, as it should
        expect(testStore.getState().views.posts.editingPost).toEqual({});
    });

    test('setEditingPost', async () => {
        // should allow to edit and should fire an action
        let testStore = mockStore({...initialState});
        const {data} = await testStore.dispatch(Actions.setEditingPost('latest_post_id', 'test', 'title'));
        expect(data).toEqual(true);

        expect(testStore.getActions()).toEqual(
            [{data: {isRHS: false, postId: 'latest_post_id', refocusId: 'test', title: 'title', show: true}, type: ActionTypes.TOGGLE_EDITING_POST}],
        );

        const general = {
            license: {IsLicensed: 'true'},
            serverVersion: '5.4.0',
            config: {PostEditTimeLimit: -1},
        } as unknown as GlobalState['entities']['general'];
        const withLicenseState = {...initialState};
        withLicenseState.entities.general = {
            ...withLicenseState.entities.general,
            ...general,
        };

        testStore = mockStore(withLicenseState);

        const {data: withLicenseData} = await testStore.dispatch(Actions.setEditingPost('latest_post_id', 'test', 'title'));
        expect(withLicenseData).toEqual(true);
        expect(testStore.getActions()).toEqual(
            [{data: {isRHS: false, postId: 'latest_post_id', refocusId: 'test', title: 'title', show: true}, type: ActionTypes.TOGGLE_EDITING_POST}],
        );

        // should not allow edit for pending post
        const newLatestPost = {...latestPost, pending_post_id: latestPost.id} as Post;
        const withPendingPostState = {...initialState};
        withPendingPostState.entities.posts.posts[latestPost.id] = newLatestPost;

        testStore = mockStore(withPendingPostState);

        const {data: withPendingPostData} = await testStore.dispatch(Actions.setEditingPost('latest_post_id', 'test', 'title'));
        expect(withPendingPostData).toEqual(false);
        expect(testStore.getActions()).toEqual([]);
    });

    test('searchForTerm', async () => {
        const testStore = mockStore(initialState);

        await testStore.dispatch(Actions.searchForTerm('hello'));
        expect(testStore.getActions()).toEqual([
            {terms: 'hello', type: 'UPDATE_RHS_SEARCH_TERMS'},
            {state: 'search', type: 'UPDATE_RHS_STATE'},
            {terms: '', type: 'UPDATE_RHS_SEARCH_RESULTS_TERMS'},
            {isGettingMore: false, type: 'SEARCH_POSTS_REQUEST'},
            {isGettingMore: false, type: 'SEARCH_FILES_REQUEST'},
        ]);
    });

    describe('createPost', () => {
        test('no emojis', async () => {
            const testStore = mockStore(initialState);
            const newPost = {id: 'new_post_id', channel_id: 'current_channel_id', message: 'new message'} as Post;
            const newReply = {id: 'reply_post_id', channel_id: 'current_channel_id', message: 'new message', root_id: 'new_post_id'} as Post;
            const files: FileInfo[] = [];

            const immediateExpectedState = [{
                args: [newPost, files],
                type: 'MOCK_CREATE_POST_IMMEDIATELY',
            }, {
                args: ['draft_current_channel_id', null],
                type: 'MOCK_SET_GLOBAL_ITEM',
            }];

            await testStore.dispatch(Actions.createPost(newPost, files));
            expect(testStore.getActions()).toEqual(immediateExpectedState);

            const finalExpectedState = [
                ...immediateExpectedState,
                {
                    args: [newReply, files],
                    type: 'MOCK_CREATE_POST',
                }, {
                    args: ['comment_draft_new_post_id', null],
                    type: 'MOCK_SET_GLOBAL_ITEM',
                },
            ];

            await testStore.dispatch(Actions.createPost(newReply, files));
            expect(testStore.getActions()).toEqual(finalExpectedState);
        });

        test('with single shorthand emoji', async () => {
            const testStore = mockStore(initialState);
            const newPost = {id: 'new_post_id', channel_id: 'current_channel_id', message: 'new message :+1:'} as Post;
            const files: FileInfo[] = [];

            const immediateExpectedState = [{
                args: [['+1']],
                type: 'MOCK_ADD_RECENT_EMOJIS',
            }, {
                args: [newPost, files],
                type: 'MOCK_CREATE_POST',
            }, {
                args: ['draft_current_channel_id', null],
                type: 'MOCK_SET_GLOBAL_ITEM',
            }];

            await testStore.dispatch(Actions.createPost(newPost, files));
            expect(testStore.getActions()).toEqual(immediateExpectedState);
        });

        test('with single named emoji', async () => {
            const testStore = mockStore(initialState);
            const newPost = {id: 'new_post_id', channel_id: 'current_channel_id', message: 'new message :cake:'} as Post;
            const files: FileInfo[] = [];

            const immediateExpectedState = [{
                args: [['cake']],
                type: 'MOCK_ADD_RECENT_EMOJIS',
            }, {
                args: [newPost, files],
                type: 'MOCK_CREATE_POST',
            }, {
                args: ['draft_current_channel_id', null],
                type: 'MOCK_SET_GLOBAL_ITEM',
            }];

            await testStore.dispatch(Actions.createPost(newPost, files));
            expect(testStore.getActions()).toEqual(immediateExpectedState);
        });

        test('with multiple emoji', async () => {
            const testStore = mockStore(initialState);
            const newPost = {id: 'new_post_id', channel_id: 'current_channel_id', message: 'new message :cake: :+1:'} as Post;
            const files: FileInfo[] = [];

            const immediateExpectedState = [{
                args: [['cake', '+1']],
                type: 'MOCK_ADD_RECENT_EMOJIS',
            }, {
                args: [newPost, files],
                type: 'MOCK_CREATE_POST',
            }, {
                args: ['draft_current_channel_id', null],
                type: 'MOCK_SET_GLOBAL_ITEM',
            }];

            await testStore.dispatch(Actions.createPost(newPost, files));
            expect(testStore.getActions()).toEqual(immediateExpectedState);
        });
    });

    test('addReaction', async () => {
        const testStore = mockStore(initialState);

        await testStore.dispatch(Actions.addReaction('post_id_1', 'emoji_name_1'));
        expect(testStore.getActions()).toEqual([
            {args: ['post_id_1', 'emoji_name_1'], type: 'MOCK_ADD_REACTION'},
            {args: ['emoji_name_1'], type: 'MOCK_ADD_RECENT_EMOJI'},
        ]);
    });

    test('flagPost', async () => {
        const rhs = {rhsState: RHSStates.FLAG} as unknown as GlobalState['views']['rhs'];
        const views = {rhs} as GlobalState['views'];
        const testStore = mockStore({...initialState, views});

        const post = testStore.getState().entities.posts.posts[latestPost.id];

        await testStore.dispatch(Actions.flagPost(post.id));
        expect(testStore.getActions()).toEqual([
            {args: [post.id], type: 'MOCK_FLAG_POST'},
            {data: {posts: {[post.id]: post}, order: [post.id]}, type: SearchTypes.RECEIVED_SEARCH_POSTS},
        ]);
    });

    test('unflagPost', async () => {
        const rhs = {rhsState: RHSStates.FLAG} as unknown as GlobalState['views']['rhs'];
        const views = {rhs} as GlobalState['views'];
        const testStore = mockStore({views, entities: {...initialState.entities, search: {results: [latestPost.id]}}} as GlobalState);

        const post = testStore.getState().entities.posts.posts[latestPost.id];

        await testStore.dispatch(Actions.unflagPost(post.id));
        expect(testStore.getActions()).toEqual([
            {args: [post.id], type: 'MOCK_UNFLAG_POST'},
            {data: {posts: [], order: []}, type: SearchTypes.RECEIVED_SEARCH_POSTS},
        ]);
    });

    test('pinPost', async () => {
        const rhs = {rhsState: RHSStates.PIN} as unknown as GlobalState['views']['rhs'];
        const views = {rhs} as GlobalState['views'];
        const testStore = mockStore({...initialState, views});

        const post = testStore.getState().entities.posts.posts[latestPost.id];

        await testStore.dispatch(Actions.pinPost(post.id));
        expect(testStore.getActions()).toEqual([
            {args: [post.id], type: 'MOCK_PIN_POST'},
            {data: {posts: {[post.id]: post}, order: [post.id]}, type: SearchTypes.RECEIVED_SEARCH_POSTS},
        ]);
    });

    test('unpinPost', async () => {
        const testStore = mockStore({views: {rhs: {rhsState: RHSStates.PIN}}, entities: {...initialState.entities, search: {results: [latestPost.id]}}} as GlobalState);

        const post = testStore.getState().entities.posts.posts[latestPost.id];

        await testStore.dispatch(Actions.unpinPost(post.id));
        expect(testStore.getActions()).toEqual([
            {args: [post.id], type: 'MOCK_UNPIN_POST'},
            {data: {posts: [], order: []}, type: SearchTypes.RECEIVED_SEARCH_POSTS},
        ]);
    });
});
