// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    addMessageIntoHistory,
} from 'mattermost-redux/actions/posts';
import {Posts} from 'mattermost-redux/constants';

import {executeCommand} from 'actions/command';
import * as HookActions from 'actions/hooks';
import * as PostActions from 'actions/post_actions';
import {
    onSubmit,
    submitPost,
    submitCommand,
} from 'actions/views/create_comment';

import mockStore from 'tests/test_store';
import {StoragePrefixes} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

/* eslint-disable global-require */

jest.mock('mattermost-redux/client', () => {
    const original = jest.requireActual('mattermost-redux/client');

    return {
        ...original,
        Client4: {
            ...original.Client4,
            deleteDraft: jest.fn().mockResolvedValue([]),
            upsertDraft: jest.fn().mockResolvedValue([]),
        },
    };
});

jest.mock('mattermost-redux/actions/posts', () => ({
    removeReaction: (...args) => ({type: 'MOCK_REMOVE_REACTION', args}),
    addMessageIntoHistory: (...args) => ({type: 'MOCK_ADD_MESSAGE_INTO_HISTORY', args}),
    moveHistoryIndexBack: (...args) => ({type: 'MOCK_MOVE_MESSAGE_HISTORY_BACK', args}),
    moveHistoryIndexForward: (...args) => ({type: 'MOCK_MOVE_MESSAGE_HISTORY_FORWARD', args}),
}));

jest.mock('actions/command', () => ({
    executeCommand: jest.fn((...args) => ({type: 'MOCK_ACTIONS_COMMAND_EXECUTE', args})),
}));

jest.mock('actions/global_actions', () => ({
    emitUserCommentedEvent: jest.fn(),
}));

jest.mock('actions/hooks', () => ({
    runMessageWillBePostedHooks: jest.fn((post) => () => ({data: post})),
    runSlashCommandWillBePostedHooks: jest.fn((message, args) => () => ({data: {message, args}})),
}));

jest.mock('actions/post_actions', () => ({
    submitReaction: (...args) => ({type: 'MOCK_SUBMIT_REACTION', args}),
    addReaction: (...args) => ({type: 'MOCK_ADD_REACTION', args}),
    createPost: jest.fn(() => ({type: 'MOCK_CREATE_POST'})),
    setEditingPost: (...args) => ({type: 'MOCK_SET_EDITING_POST', args}),
}));

jest.mock('actions/storage', () => {
    const original = jest.requireActual('actions/storage');
    return {
        ...original,
        setGlobalItem: (...args) => ({type: 'MOCK_SET_GLOBAL_ITEM', args}),
        actionOnGlobalItemsWithPrefix: (...args) => ({type: 'MOCK_ACTION_ON_GLOBAL_ITEMS_WITH_PREFIX', args}),
    };
});

function lastCall(calls) {
    return calls[calls.length - 1];
}

const rootId = 'fc234c34c23';
const currentUserId = '34jrnfj43';
const teamId = '4j5nmn4j3';
const channelId = '4j5j4k3k34j4';
const latestPostId = 'latestPostId';

describe('rhs view actions', () => {
    const initialState = {
        entities: {
            posts: {
                posts: {
                    [latestPostId]: {
                        id: latestPostId,
                        user_id: currentUserId,
                        message: 'test msg',
                        channel_id: channelId,
                        root_id: rootId,
                        create_at: 42,
                    },
                    [rootId]: {
                        id: rootId,
                        user_id: currentUserId,
                        message: 'root msg',
                        channel_id: channelId,
                        root_id: '',
                        create_at: 2,
                    },
                },
                postsInChannel: {
                    [channelId]: [
                        {order: [latestPostId], recent: true},
                    ],
                },
                postsInThread: {
                    [rootId]: [latestPostId],
                },
                messagesHistory: {
                    index: {
                        [Posts.MESSAGE_TYPES.COMMENT]: 0,
                    },
                    messages: ['test message'],
                },
            },
            channels: {
                channels: {
                    [channelId]: TestHelper.getChannelMock({id: channelId}),
                },
                roles: {
                    [channelId]: new Set(['channel_roles']),
                },
            },
            preferences: {
                myPreferences: {},
            },
            users: {
                currentUserId,
                profiles: {
                    [currentUserId]: TestHelper.getUserMock({id: currentUserId}),
                },
            },
            teams: {
                currentTeamId: teamId,
            },
            emojis: {
                customEmoji: {},
            },
            roles: {
                roles: {
                    channel_roles: {
                        permissions: '',
                    },
                },
            },
            general: {
                config: {
                    EnableCustomEmoji: 'true',
                },
            },
        },
        storage: {
            storage: {
                [`${StoragePrefixes.COMMENT_DRAFT}${rootId}`]: {
                    value: {
                        message: '',
                        fileInfos: [],
                        uploadsInProgress: [],
                        channelId,
                        rootId,
                    },
                    timestamp: new Date(),
                },
            },
        },
        websocket: {
            connectionId: '',
        },
    };

    let store;

    beforeEach(() => {
        store = mockStore(initialState);
    });

    describe('submitPost', () => {
        const draft = {message: '', channelId, rootId, fileInfos: []};

        const post = {
            file_ids: [],
            message: draft.message,
            channel_id: channelId,
            root_id: rootId,
            user_id: currentUserId,
        };

        test('it call PostActions.createPost with post', async () => {
            await store.dispatch(submitPost(channelId, rootId, draft));

            expect(HookActions.runMessageWillBePostedHooks).toHaveBeenCalled();
            expect(PostActions.createPost).toHaveBeenCalled();

            expect(lastCall(PostActions.createPost.mock.calls)[0]).toEqual(
                expect.objectContaining(post),
            );

            expect(lastCall(PostActions.createPost.mock.calls)[1]).toBe(draft.fileInfos);
        });

        test('it does not call PostActions.createPost when hooks fail', async () => {
            HookActions.runMessageWillBePostedHooks.mockImplementation(() => () => ({error: {message: 'An error occurred'}}));

            await store.dispatch(submitPost(channelId, rootId, draft));

            expect(HookActions.runMessageWillBePostedHooks).toHaveBeenCalled();
            expect(PostActions.createPost).not.toHaveBeenCalled();
        });
    });

    describe('submitCommand', () => {
        const args = {
            channel_id: channelId,
            team_id: teamId,
            root_id: rootId,
        };

        const draft = {message: '/test msg', channelId, rootId};

        test('it calls executeCommand', async () => {
            await store.dispatch(submitCommand(channelId, rootId, draft));

            expect(HookActions.runSlashCommandWillBePostedHooks).toHaveBeenCalled();
            expect(executeCommand).toHaveBeenCalled();

            // First argument
            expect(lastCall(executeCommand.mock.calls)[0]).toEqual(draft.message);

            // Second argument
            expect(lastCall(executeCommand.mock.calls)[1]).toEqual(args);
        });

        test('it does not call executeComaand when hooks fail', async () => {
            HookActions.runSlashCommandWillBePostedHooks.mockImplementation(() => () => ({error: {message: 'An error occurred'}}));

            await store.dispatch(submitCommand(channelId, rootId, draft));

            expect(HookActions.runSlashCommandWillBePostedHooks).toHaveBeenCalled();
            expect(executeCommand).not.toHaveBeenCalled();
        });

        test('it should not error in case of an empty response', async () => {
            HookActions.runSlashCommandWillBePostedHooks.mockImplementation(() => () => ({data: {}}));

            const res = await store.dispatch(submitCommand(channelId, rootId, draft));
            expect(res).toStrictEqual({});

            expect(HookActions.runSlashCommandWillBePostedHooks).toHaveBeenCalled();
            expect(executeCommand).not.toHaveBeenCalled();
        });

        test('it calls submitPost on error.sendMessage', async () => {
            jest.mock('actions/channel_actions', () => ({
                executeCommand: jest.fn((message, _args, resolve, reject) => reject({sendMessage: 'test'})),
            }));

            jest.resetModules();

            const {submitCommand: remockedSubmitCommand} = require('actions/views/create_comment');

            await store.dispatch(remockedSubmitCommand(channelId, rootId, draft));

            const expectedActions = [{args: ['/test msg', {channel_id: '4j5j4k3k34j4', root_id: 'fc234c34c23', team_id: '4j5nmn4j3'}], type: 'MOCK_ACTIONS_COMMAND_EXECUTE'}];
            expect(store.getActions()).toEqual(expectedActions);
        });
    });

    describe('onSubmit', () => {
        const draft = {
            message: 'test',
            fileInfos: [],
            uploadsInProgress: [],
            rootId,
            channelId,
        };

        test('it adds message into history', () => {
            store.dispatch(onSubmit(draft, {}));

            const testStore = mockStore(initialState);
            testStore.dispatch(addMessageIntoHistory('test'));

            expect(store.getActions()).toEqual(
                expect.arrayContaining(testStore.getActions()),
            );
        });

        test('it submits a command when message is /away', () => {
            store.dispatch(onSubmit({
                message: '/away',
                fileInfos: [],
                uploadsInProgress: [],
            }, {}));

            const testStore = mockStore(initialState);
            testStore.dispatch(submitCommand(channelId, rootId, {message: '/away', fileInfos: [], uploadsInProgress: []}));

            const commandActions = [{args: ['/away', {channel_id: '4j5j4k3k34j4', root_id: 'fc234c34c23', team_id: '4j5nmn4j3'}], type: 'MOCK_ACTIONS_COMMAND_EXECUTE'}];
            expect(store.getActions()).toEqual(
                expect.arrayContaining(testStore.getActions()),
                expect.arrayContaining(commandActions),
            );
        });

        test('it submits a regular post when options.ignoreSlash is true', () => {
            store.dispatch(onSubmit({
                message: '/fakecommand',
                fileInfos: [],
                uploadsInProgress: [],
            }, {ignoreSlash: true}));

            const testStore = mockStore(initialState);
            testStore.dispatch(submitPost(channelId, rootId, {message: '/fakecommand', fileInfos: [], uploadsInProgress: []}));

            expect(store.getActions()).toEqual(
                expect.arrayContaining(testStore.getActions()),
                expect.arrayContaining([{args: ['/fakecommand'], type: 'MOCK_ADD_MESSAGE_INTO_HISTORY'}]),
            );
        });

        test('it submits a regular post when message is something else', () => {
            store.dispatch(onSubmit({
                message: 'test msg',
                fileInfos: [],
                uploadsInProgress: [],
            }, {}));

            const testStore = mockStore(initialState);
            testStore.dispatch(submitPost(channelId, rootId, {message: 'test msg', fileInfos: [], uploadsInProgress: []}));

            expect(store.getActions()).toEqual(
                expect.arrayContaining(testStore.getActions()),
                expect.arrayContaining([{args: ['test msg'], type: 'MOCK_ADD_MESSAGE_INTO_HISTORY'}]),
            );
        });
    });
});
