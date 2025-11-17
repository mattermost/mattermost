// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';

import type {FileInfo, FilesState} from '@mattermost/types/files';
import type {Post} from '@mattermost/types/posts';

import {ChannelTypes, SearchTypes} from 'mattermost-redux/action_types';
import * as PostActions from 'mattermost-redux/actions/posts';
import {Client4} from 'mattermost-redux/client';
import {Posts} from 'mattermost-redux/constants';

import * as Actions from 'actions/post_actions';

import test_helper from 'packages/mattermost-redux/test/test_helper';
import mockStore from 'tests/test_store';
import {Constants, ActionTypes, RHSStates} from 'utils/constants';
import * as PostUtils from 'utils/post_utils';

import type {GlobalState} from 'types/store';

import {sendDesktopNotification} from './notification_actions';

jest.mock('mattermost-redux/actions/posts', () => ({
    removeReaction: (...args: any[]) => ({type: 'MOCK_REMOVE_REACTION', args}),
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
    sendDesktopNotification: jest.fn().mockReturnValue(() => ({data: {}})),
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

jest.mock('utils/post_utils', () => ({
    makeGetUniqueEmojiNameReactionsForPost: jest.fn(),
    makeGetIsReactionAlreadyAddedToPost: jest.fn(),
}));

const mockMakeGetIsReactionAlreadyAddedToPost = PostUtils.makeGetIsReactionAlreadyAddedToPost as unknown as jest.Mock<() => boolean>;
const mockMakeGetUniqueEmojiNameReactionsForPost = PostUtils.makeGetUniqueEmojiNameReactionsForPost as unknown as jest.Mock<() => string[]>;

const mockedSendDesktopNotification = jest.mocked(sendDesktopNotification);

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
        type: 'normal',
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
                searchType: '',
                filesSearchExtFilter: [],
            },
        },
        storage: {
            storage: {},
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
        ]);
        expect(mockedSendDesktopNotification).toHaveBeenCalled();
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
        ]);
        expect(mockedSendDesktopNotification).toHaveBeenCalled();
    });

    test('unsetEditingPost', async () => {
        // should allow to edit and should fire an action
        const testStore = mockStore({...initialState});
        const {data: dataSet} = await testStore.dispatch((Actions.setEditingPost as any)('latest_post_id', 'test'));
        expect(dataSet).toEqual(true);

        // matches the action to set editingPost
        expect(testStore.getActions()[0].payload[0]).toEqual(
            {data: {isRHS: false, postId: 'latest_post_id', refocusId: 'test', show: true}, type: ActionTypes.TOGGLE_EDITING_POST},
        );

        // clear actions
        testStore.clearActions();

        // dispatch action to unset the editingPost
        const {data: dataUnset} = testStore.dispatch(Actions.unsetEditingPost());
        expect(dataUnset).toEqual(true);

        // matches the action to unset editingPost
        expect(testStore.getActions()[0].payload[0]).toEqual(
            {data: {show: false}, type: ActionTypes.TOGGLE_EDITING_POST},
        );

        // editingPost value is empty object, as it should
        expect(testStore.getState().views.posts.editingPost).toEqual({});
    });

    test('setEditingPost', async () => {
        const state = JSON.parse(JSON.stringify(initialState)) as GlobalState;

        state.entities.posts.posts[latestPost.id] = {
            ...latestPost,
            file_ids: ['file_id_1', 'file_id_2'],
        } as Post;

        state.entities.files = {
            files: {
                file_id_1: test_helper.getFileInfoMock({id: 'file_id_1', post_id: 'latest_post_id'}),
                file_id_2: test_helper.getFileInfoMock({id: 'file_id_2', post_id: 'latest_post_id'}),
            },
            fileIdsByPostId: {
                [latestPost.id]: ['file_id_1', 'file_id_2'],
            },
        } as unknown as FilesState;

        // should allow to edit and should fire an action
        let testStore = mockStore({...state});
        const {data} = await testStore.dispatch(Actions.setEditingPost('latest_post_id', 'test'));
        expect(data).toEqual(true);

        let actions = testStore.getActions();
        expect(actions.length).toEqual(1);
        expect(actions[0].payload.length).toEqual(2);

        expect(actions[0].payload[0]).toEqual(
            {data: {isRHS: false, postId: 'latest_post_id', refocusId: 'test', show: true}, type: ActionTypes.TOGGLE_EDITING_POST},
        );
        expect(actions[0].payload[1]).toEqual(
            {
                args: [
                    'edit_draft_latest_post_id',
                    {
                        id: 'latest_post_id',
                        user_id: 'current_user_id',
                        message: 'test msg',
                        channel_id: 'current_channel_id',
                        type: 'normal',
                        file_ids: [
                            'file_id_1',
                            'file_id_2',
                        ],
                        metadata: {
                            files: [
                                test_helper.getFileInfoMock({id: 'file_id_1', post_id: 'latest_post_id'}),
                                test_helper.getFileInfoMock({id: 'file_id_2', post_id: 'latest_post_id'}),
                            ],
                        },
                    },
                ],
                type: 'MOCK_SET_GLOBAL_ITEM',
            },
        );

        const general = {
            license: {IsLicensed: 'true'},
            serverVersion: '5.4.0',
            config: {PostEditTimeLimit: -1},
        } as unknown as GlobalState['entities']['general'];
        const withLicenseState = {...state};
        withLicenseState.entities.general = {
            ...withLicenseState.entities.general,
            ...general,
        };

        testStore = mockStore(withLicenseState);

        const {data: withLicenseData} = await testStore.dispatch(Actions.setEditingPost('latest_post_id', 'test'));
        expect(withLicenseData).toEqual(true);

        expect(testStore.getActions()[0].payload[0]).toEqual(
            {data: {isRHS: false, postId: 'latest_post_id', refocusId: 'test', show: true}, type: ActionTypes.TOGGLE_EDITING_POST},
        );

        // should not allow edit for pending post
        const newLatestPost = {...latestPost, pending_post_id: latestPost.id} as Post;
        const withPendingPostState = {...state};
        withPendingPostState.entities.posts.posts[latestPost.id] = newLatestPost;

        testStore = mockStore(withPendingPostState);

        const {data: withPendingPostData} = await testStore.dispatch(Actions.setEditingPost('latest_post_id', 'test'));
        expect(withPendingPostData).toEqual(false);
        expect(testStore.getActions()).toEqual([]);

        // should not save draft when it already exists
        const stateWithDraft = {
            ...state,
            storage: {
                ...state.storage,
                storage: {
                    ...state.storage.storage,
                    edit_draft_latest_post_id: {
                        timestamp: new Date(),
                        value: {id: 'latest_post_id', user_id: 'current_user_id', message: 'test msg', channel_id: 'current_channel_id', type: 'normal'},
                    },
                },
            },
        } as unknown as GlobalState;

        stateWithDraft.entities.posts.posts[latestPost.id] = latestPost as Post;

        testStore = mockStore(stateWithDraft);

        const {data: dataExisting} = await testStore.dispatch(Actions.setEditingPost('latest_post_id', 'test'));
        expect(dataExisting).toEqual(true);

        actions = testStore.getActions();
        expect(actions.length).toEqual(1);
        expect(actions[0].payload.length).toEqual(1);

        expect(actions[0].payload[0]).toEqual(
            {data: {isRHS: false, postId: 'latest_post_id', refocusId: 'test', show: true}, type: ActionTypes.TOGGLE_EDITING_POST},
        );
    });

    test('searchForTerm', async () => {
        const testStore = mockStore(initialState);

        await testStore.dispatch(Actions.searchForTerm('hello'));
        expect(testStore.getActions()).toEqual([
            {terms: 'hello', type: 'UPDATE_RHS_SEARCH_TERMS'},
            {state: 'search', type: 'UPDATE_RHS_STATE'},
            {terms: '', type: 'UPDATE_RHS_SEARCH_RESULTS_TERMS'},
            {searchType: '', type: 'UPDATE_RHS_SEARCH_RESULTS_TYPE'},
            {isGettingMore: false, type: 'SEARCH_POSTS_REQUEST'},
            {data: {firstInaccessiblePostTime: 0, searchType: 'posts'}, type: 'RECEIVED_SEARCH_TRUNCATION_INFO'},
            {isGettingMore: false, type: 'SEARCH_FILES_REQUEST'},
            {data: {firstInaccessiblePostTime: 0, searchType: 'files'}, type: 'RECEIVED_SEARCH_TRUNCATION_INFO'},
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
                type: 'MOCK_CREATE_POST',
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

    describe('submitReaction', () => {
        describe('addReaction', () => {
            test('should add reaction when the action is + and the reaction is not added', async () => {
                const testStore = mockStore(initialState);

                mockMakeGetIsReactionAlreadyAddedToPost.mockReturnValueOnce(() => false);

                testStore.dispatch(Actions.submitReaction('post_id_1', '+', 'emoji_name_1'));

                expect(testStore.getActions()).toEqual([
                    {args: ['emoji_name_1'], type: 'MOCK_ADD_RECENT_EMOJI'},
                    {args: ['post_id_1', 'emoji_name_1'], type: 'MOCK_ADD_REACTION'},
                ]);
            });

            test('should take no action when the action is + and the reaction has already been added', async () => {
                const testStore = mockStore(initialState);

                mockMakeGetIsReactionAlreadyAddedToPost.mockReturnValueOnce(() => true);

                testStore.dispatch(Actions.submitReaction('post_id_1', '+', 'emoji_name_1'));

                expect(testStore.getActions()).toEqual([]);
            });
        });

        describe('removeReaction', () => {
            test('should remove reaction when the action is - and the reaction has already been added', async () => {
                const testStore = mockStore(initialState);

                mockMakeGetIsReactionAlreadyAddedToPost.mockReturnValueOnce(() => true);

                testStore.dispatch(Actions.submitReaction('post_id_1', '-', 'emoji_name_1'));

                expect(testStore.getActions()).toEqual([
                    {args: ['post_id_1', 'emoji_name_1'], type: 'MOCK_REMOVE_REACTION'},
                ]);
            });

            test('should take no action when the action is - and the reaction is not added', async () => {
                const testStore = mockStore(initialState);

                mockMakeGetIsReactionAlreadyAddedToPost.mockReturnValueOnce(() => false);

                testStore.dispatch(Actions.submitReaction('post_id_1', '-', 'emoji_name_1'));

                expect(testStore.getActions()).toEqual([]);
            });
        });
    });

    describe('toggleReaction', () => {
        test('should add reaction when the reaction is not added', async () => {
            const testStore = mockStore(initialState);

            mockMakeGetIsReactionAlreadyAddedToPost.mockReturnValueOnce(() => false);

            testStore.dispatch(Actions.toggleReaction('post_id_1', 'emoji_name_1'));

            expect(testStore.getActions()).toEqual([
                {args: ['emoji_name_1'], type: 'MOCK_ADD_RECENT_EMOJI'},
                {args: ['post_id_1', 'emoji_name_1'], type: 'MOCK_ADD_REACTION'},
            ]);
        });

        test('should remove reaction when the reaction has already been added', async () => {
            const testStore = mockStore(initialState);

            mockMakeGetIsReactionAlreadyAddedToPost.mockReturnValueOnce(() => true);

            testStore.dispatch(Actions.toggleReaction('post_id_1', 'emoji_name_1'));

            expect(testStore.getActions()).toEqual([
                {args: ['post_id_1', 'emoji_name_1'], type: 'MOCK_REMOVE_REACTION'},
            ]);
        });
    });

    describe('addReaction', () => {
        mockMakeGetUniqueEmojiNameReactionsForPost.mockReturnValue(() => []);

        test('should add reaction', async () => {
            const testStore = mockStore(initialState);

            await testStore.dispatch(Actions.addReaction('post_id_1', 'emoji_name_1'));
            expect(testStore.getActions()).toEqual([
                {args: ['emoji_name_1'], type: 'MOCK_ADD_RECENT_EMOJI'},
                {args: ['post_id_1', 'emoji_name_1'], type: 'MOCK_ADD_REACTION'},
            ]);
        });
        test('should not add reaction if we are over the limit', async () => {
            mockMakeGetUniqueEmojiNameReactionsForPost.mockReturnValue(() => ['another_emoji']);
            const testStore = mockStore({
                ...initialState,
                entities: {
                    ...initialState.entities,
                    general: {
                        ...initialState.entities.general,
                        config: {
                            ...initialState.entities.general.config,
                            UniqueEmojiReactionLimitPerPost: '1',
                        },
                    },
                },
            });

            await testStore.dispatch(Actions.addReaction('post_id_1', 'emoji_name_1'));
            expect(testStore.getActions()).not.toEqual([
                {args: ['post_id_1', 'emoji_name_1'], type: 'MOCK_ADD_REACTION'},
                {args: ['emoji_name_1'], type: 'MOCK_ADD_RECENT_EMOJI'},
            ]);
        });
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

describe('fetchChannelsForPostIfNeeded', () => {
    beforeAll(() => {
        test_helper.initBasic(Client4);
    });

    afterAll(() => {
        test_helper.tearDown();
    });

    const teamId = 'test-team-id';
    const channelId = 'test-channel-id';

    it('should return early if post channel not found in store', async () => {
        const initialState = {
            entities: {
                channels: {
                    channels: {},
                },
                teams: {
                    teams: {},
                },
            },
        };

        const post = test_helper.fakePostWithId(channelId);
        post.message = 'Check out ~test-channel';

        const testStore = await mockStore(initialState);
        await testStore.dispatch(Actions.fetchChannelsForPostIfNeeded(post));

        // Should not dispatch any actions since post channel not found
        expect(testStore.getActions()).toEqual([]);
    });

    it('should return early for DM/GM posts (no team_id)', async () => {
        const dmChannel = test_helper.fakeChannelWithId('');
        dmChannel.team_id = '';
        dmChannel.type = 'D';

        const initialState = {
            entities: {
                channels: {
                    channels: {
                        [dmChannel.id]: dmChannel,
                    },
                },
                teams: {
                    teams: {},
                },
            },
        };

        const post = test_helper.fakePostWithId(dmChannel.id);
        post.message = 'Check out ~test-channel';

        const testStore = await mockStore(initialState);
        await testStore.dispatch(Actions.fetchChannelsForPostIfNeeded(post));

        // Should not dispatch any actions for DM/GM
        expect(testStore.getActions()).toEqual([]);
    });

    it('should return early if no channel mentions in post', async () => {
        const channel = test_helper.fakeChannelWithId(teamId);
        const team = test_helper.fakeTeamWithId();
        team.id = teamId;

        const initialState = {
            entities: {
                channels: {
                    channels: {
                        [channel.id]: channel,
                    },
                },
                teams: {
                    teams: {
                        [teamId]: team,
                    },
                },
            },
        };

        const post = test_helper.fakePostWithId(channel.id);
        post.message = 'Just a regular message without mentions';

        const testStore = await mockStore(initialState);
        await testStore.dispatch(Actions.fetchChannelsForPostIfNeeded(post));

        // Should not dispatch any actions when no mentions
        expect(testStore.getActions()).toEqual([]);
    });

    it('should return early if all mentioned channels already in store', async () => {
        const channel = test_helper.fakeChannelWithId(teamId);
        const team = test_helper.fakeTeamWithId();
        team.id = teamId;

        const mentionedChannel = test_helper.fakeChannelWithId(teamId);
        mentionedChannel.name = 'existing-channel';
        mentionedChannel.display_name = 'Existing Channel';

        const initialState = {
            entities: {
                channels: {
                    channels: {
                        [channel.id]: channel,
                        [mentionedChannel.id]: mentionedChannel,
                    },
                },
                teams: {
                    teams: {
                        [teamId]: team,
                    },
                },
            },
        };

        const post = test_helper.fakePostWithId(channel.id);
        post.message = 'Check out ~existing-channel';

        const testStore = await mockStore(initialState);
        await testStore.dispatch(Actions.fetchChannelsForPostIfNeeded(post));

        // Should not dispatch any actions when channels already in store
        expect(testStore.getActions()).toEqual([]);
    });

    it('should fetch missing channels mentioned in post', async () => {
        const channel = test_helper.fakeChannelWithId(teamId);
        const team = test_helper.fakeTeamWithId();
        team.id = teamId;
        team.name = 'test-team';

        const missingChannel = test_helper.fakeChannelWithId(teamId);
        missingChannel.name = 'missing-channel';
        missingChannel.display_name = 'Missing Channel';

        const initialState = {
            entities: {
                channels: {
                    channels: {
                        [channel.id]: channel,
                    },
                },
                teams: {
                    teams: {
                        [teamId]: team,
                    },
                },
            },
        };

        const post = test_helper.fakePostWithId(channel.id);
        post.message = 'Check out ~missing-channel';

        nock(Client4.getBaseRoute()).
            get(`/teams/name/${team.name}/channels/name/${missingChannel.name}?include_deleted=true`).
            reply(200, missingChannel);

        const testStore = await mockStore(initialState);
        await testStore.dispatch(Actions.fetchChannelsForPostIfNeeded(post));

        const actions = testStore.getActions();
        expect(actions.length).toBeGreaterThan(0);

        // Should dispatch RECEIVED_CHANNEL action
        const receivedChannelAction = actions.find((action: any) => action.type === 'RECEIVED_CHANNEL');
        expect(receivedChannelAction).toBeDefined();
        expect(receivedChannelAction.data.id).toBe(missingChannel.id);
    });

    it('should fetch multiple missing channels in parallel', async () => {
        const channel = test_helper.fakeChannelWithId(teamId);
        const team = test_helper.fakeTeamWithId();
        team.id = teamId;
        team.name = 'test-team';

        const missingChannel1 = test_helper.fakeChannelWithId(teamId);
        missingChannel1.name = 'channel-one';
        missingChannel1.display_name = 'Channel One';

        const missingChannel2 = test_helper.fakeChannelWithId(teamId);
        missingChannel2.name = 'channel-two';
        missingChannel2.display_name = 'Channel Two';

        const initialState = {
            entities: {
                channels: {
                    channels: {
                        [channel.id]: channel,
                    },
                },
                teams: {
                    teams: {
                        [teamId]: team,
                    },
                },
            },
        };

        const post = test_helper.fakePostWithId(channel.id);
        post.message = 'Check out ~channel-one and ~channel-two';

        nock(Client4.getBaseRoute()).
            get(`/teams/name/${team.name}/channels/name/${missingChannel1.name}?include_deleted=true`).
            reply(200, missingChannel1);

        nock(Client4.getBaseRoute()).
            get(`/teams/name/${team.name}/channels/name/${missingChannel2.name}?include_deleted=true`).
            reply(200, missingChannel2);

        const testStore = await mockStore(initialState);
        await testStore.dispatch(Actions.fetchChannelsForPostIfNeeded(post));

        const actions = testStore.getActions();

        // Should dispatch RECEIVED_CHANNEL for both channels
        const receivedChannelActions = actions.filter((action: any) => action.type === 'RECEIVED_CHANNEL');
        expect(receivedChannelActions.length).toBe(2);

        const channelIds = receivedChannelActions.map((action: any) => action.data.id);
        expect(channelIds).toContain(missingChannel1.id);
        expect(channelIds).toContain(missingChannel2.id);
    });

    it('should handle fetch errors gracefully (private/non-existent channels)', async () => {
        const channel = test_helper.fakeChannelWithId(teamId);
        const team = test_helper.fakeTeamWithId();
        team.id = teamId;
        team.name = 'test-team';

        const initialState = {
            entities: {
                channels: {
                    channels: {
                        [channel.id]: channel,
                    },
                },
                teams: {
                    teams: {
                        [teamId]: team,
                    },
                },
                users: {
                    currentUserId: 'user-id',
                },
            },
        };

        const post = test_helper.fakePostWithId(channel.id);
        post.message = 'Check out ~private-channel';

        // Mock a 404 response for private/non-existent channel
        nock(Client4.getBaseRoute()).
            get(`/teams/name/${team.name}/channels/name/private-channel?include_deleted=true`).
            reply(404, {message: 'Channel not found', status_code: 404});

        const testStore = await mockStore(initialState);

        // Should not throw an error - it catches and handles the error
        await expect(testStore.dispatch(Actions.fetchChannelsForPostIfNeeded(post))).resolves.toBeDefined();

        // The action gracefully handles the error by catching it
        // No assertion needed - the test passes if no exception is thrown
    });

    it('should extract channel mentions from attachments', async () => {
        const channel = test_helper.fakeChannelWithId(teamId);
        const team = test_helper.fakeTeamWithId();
        team.id = teamId;
        team.name = 'test-team';

        const missingChannel = test_helper.fakeChannelWithId(teamId);
        missingChannel.name = 'attachment-channel';
        missingChannel.display_name = 'Attachment Channel';

        const initialState = {
            entities: {
                channels: {
                    channels: {
                        [channel.id]: channel,
                    },
                },
                teams: {
                    teams: {
                        [teamId]: team,
                    },
                },
            },
        };

        const post = test_helper.fakePostWithId(channel.id);
        post.message = 'See attachment';
        post.props = {
            attachments: [
                {
                    text: 'Check out ~attachment-channel',
                    fields: [
                        {title: 'Field', value: 'With ~attachment-channel mention'},
                    ],
                },
            ],
        };

        nock(Client4.getBaseRoute()).
            get(`/teams/name/${team.name}/channels/name/${missingChannel.name}?include_deleted=true`).
            reply(200, missingChannel);

        const testStore = await mockStore(initialState);
        await testStore.dispatch(Actions.fetchChannelsForPostIfNeeded(post));

        const actions = testStore.getActions();
        const receivedChannelAction = actions.find((action: any) => action.type === 'RECEIVED_CHANNEL');

        // Should fetch channel mentioned in attachment
        expect(receivedChannelAction).toBeDefined();
        expect(receivedChannelAction.data.id).toBe(missingChannel.id);
    });

    it('should pass includeDeleted=true to fetch archived channels', async () => {
        const channel = test_helper.fakeChannelWithId(teamId);
        const team = test_helper.fakeTeamWithId();
        team.id = teamId;
        team.name = 'test-team';

        const archivedChannel = test_helper.fakeChannelWithId(teamId);
        archivedChannel.name = 'archived-channel';
        archivedChannel.display_name = 'Archived Channel';
        archivedChannel.delete_at = 1234567890;

        const initialState = {
            entities: {
                channels: {
                    channels: {
                        [channel.id]: channel,
                    },
                },
                teams: {
                    teams: {
                        [teamId]: team,
                    },
                },
            },
        };

        const post = test_helper.fakePostWithId(channel.id);
        post.message = 'Check out ~archived-channel';

        // Verify the request includes include_deleted=true
        const scope = nock(Client4.getBaseRoute()).
            get(`/teams/name/${team.name}/channels/name/${archivedChannel.name}?include_deleted=true`).
            reply(200, archivedChannel);

        const testStore = await mockStore(initialState);
        await testStore.dispatch(Actions.fetchChannelsForPostIfNeeded(post));

        // Verify the nock scope was called (includes include_deleted=true)
        expect(scope.isDone()).toBe(true);

        const actions = testStore.getActions();
        const receivedChannelAction = actions.find((action: any) => action.type === 'RECEIVED_CHANNEL');

        expect(receivedChannelAction).toBeDefined();
        expect(receivedChannelAction.data.id).toBe(archivedChannel.id);
        expect(receivedChannelAction.data.delete_at).toBe(1234567890);
    });
});
