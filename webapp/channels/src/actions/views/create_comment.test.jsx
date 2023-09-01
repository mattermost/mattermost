// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    removeReaction,
    addMessageIntoHistory} from 'mattermost-redux/actions/posts';
import {Posts, Permissions} from 'mattermost-redux/constants';

import {
    clearCommentDraftUploads,
    updateCommentDraft,
    submitPost,
    submitReaction,
    submitCommand,
    handleSubmit,
    makeOnEditLatestPost,
} from 'actions/views/create_comment';
import {setGlobalDraftSource, removeDraft} from 'actions/views/drafts';
import {setGlobalItem, actionOnGlobalItemsWithPrefix} from 'actions/storage';
import * as PostActions from 'actions/post_actions';
import {executeCommand} from 'actions/command';
import * as HookActions from 'actions/hooks';
import {StoragePrefixes, Constants} from 'utils/constants';
import {Client4} from 'mattermost-redux/client';
import {GroupSource} from '@mattermost/types/groups';

import mockStore from 'tests/test_store';
import mergeObjects from 'packages/mattermost-redux/test/merge_objects';

/* eslint-disable global-require */

jest.mock('mattermost-redux/client', () => {
    const original = jest.requireActual('mattermost-redux/client');

    return {
        ...original,
        Client4: {
            ...original.Client4,
            deleteDraft: jest.fn().mockResolvedValue([]),
            upsertDraft: jest.fn().mockResolvedValue([]),
            getChannelTimezones: jest.fn().mockResolvedValue([]),
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
    addReaction: (...args) => ({type: 'MOCK_ADD_REACTION', args}),
    createPost: jest.fn((...args) => ({type: 'MOCK_CREATE_POST', args})),
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
            preferences: {
                myPreferences: {},
            },
            users: {
                currentUserId,
                profiles: {
                    [currentUserId]: {id: currentUserId, roles: ''},
                },
            },
            roles: {},
            channels: {
                roles: {},
            },
            teams: {
                currentTeamId: teamId,
            },
            emojis: {
                customEmoji: {},
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

    describe('clearCommentDraftUploads', () => {
        test('it calls actionOnGlobalItemsWithPrefix action correctly', () => {
            store.dispatch(clearCommentDraftUploads());

            const actions = store.getActions();

            expect(actions.length).toBe(1);

            const callback = actions[0].args[1];

            // make sure callback is a function which clears uploadsInProgress
            expect(typeof callback).toBe('function');

            const draft = {message: 'test msg', channelId, rootId, uploadsInProgress: [3, 4], fileInfos: [{id: 1}, {id: 2}]};

            expect(callback(null, draft)).toEqual({...draft, uploadsInProgress: []});

            const testStore = mockStore(initialState);

            testStore.dispatch(actionOnGlobalItemsWithPrefix(StoragePrefixes.COMMENT_DRAFT, callback));

            expect(store.getActions()).toEqual(testStore.getActions());
        });
    });

    describe('updateCommentDraft', () => {
        const draft = {message: 'test msg', rootId, fileInfos: [{id: 1}], uploadsInProgress: [2, 3]};

        test('it calls setGlobalItem action correctly', () => {
            jest.useFakeTimers('modern');
            jest.setSystemTime(42);
            store.dispatch(updateCommentDraft(draft));

            const testStore = mockStore(initialState);

            const expectedKey = `${StoragePrefixes.COMMENT_DRAFT}${rootId}`;
            testStore.dispatch(setGlobalItem(expectedKey, {
                ...draft,
                createAt: 42,
                updateAt: 42,
            }));
            testStore.dispatch(setGlobalDraftSource(expectedKey, false));

            jest.runOnlyPendingTimers();
            expect(store.getActions()).toEqual(testStore.getActions());
            jest.useRealTimers();
        });
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

            // Restore the mock
            HookActions.runMessageWillBePostedHooks.mockImplementation((p) => () => ({data: p}));
        });
    });

    describe('submitReaction', () => {
        test('it adds a reaction when action is +', () => {
            store.dispatch(submitReaction('post_id_1', '+', 'emoji_name_1'));

            const testStore = mockStore(initialState);
            testStore.dispatch(PostActions.addReaction('post_id_1', 'emoji_name_1'));
            expect(store.getActions()).toEqual(testStore.getActions());
        });

        test('it removes a reaction when action is -', () => {
            store.dispatch(submitReaction('post_id_1', '-', 'emoji_name_1'));

            const testStore = mockStore(initialState);
            testStore.dispatch(removeReaction('post_id_1', 'emoji_name_1'));

            expect(store.getActions()).toEqual(testStore.getActions());
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

            HookActions.runSlashCommandWillBePostedHooks.mockImplementation((message, a) => () => ({data: {message, args: a}}));
        });

        test('it calls submitPost on error.sendMessage', async () => {
            jest.mock('actions/channel_actions', () => ({
                executeCommand: jest.fn((message, _args, resolve, reject) => reject({sendMessage: 'test'})),
            }));

            jest.resetModules();

            const {submitCommand: remockedSubmitCommand} = require('actions/views/create_comment'); // eslint-disable-like @typescript-eslint/no-var-requires

            await store.dispatch(remockedSubmitCommand(channelId, rootId, draft));

            const expectedActions = [{args: ['/test msg', {channel_id: '4j5j4k3k34j4', root_id: 'fc234c34c23', team_id: '4j5nmn4j3'}], type: 'MOCK_ACTIONS_COMMAND_EXECUTE'}];
            expect(store.getActions()).toEqual(expectedActions);
        });
    });

    describe('makeOnEditLatestPost', () => {
        const onEditLatestPost = makeOnEditLatestPost(rootId);

        test('it dispatches the correct actions', () => {
            store.dispatch(onEditLatestPost());

            expect(store.getActions()).toEqual([
                PostActions.setEditingPost(
                    latestPostId,
                    'reply_textbox',
                    'Comment',
                    true,
                ),
            ]);
        });
    });
});

describe('handleSubmit', () => {
    const baseDraft = {
        message: 'text',
        channelId: 'current_channel_id',
        postId: 'current_post_id',
        uploadsInProgress: [],
    };
    const initialState = {
        entities: {
            general: {
                config: {
                    EnableConfirmNotificationsToChannel: 'false',
                    EnableCustomGroups: 'false',
                    PostPriority: 'false',
                    ExperimentalTimezone: 'false',
                    EnableCustomEmoji: 'false',
                    AllowSyncedDrafts: 'false',
                },
                license: {
                    IsLicensed: 'false',
                    LDAPGroups: 'false',
                },
            },
            channels: {
                channels: {
                    current_channel_id: {
                        id: 'current_channel_id',
                        group_constrained: false,
                        team_id: 'current_team_id',
                        type: 'O',
                    },
                },
                stats: {
                    current_channel_id: {
                        member_count: 1,
                    },
                },
                roles: {
                    current_channel_id: new Set(['channel_roles']),
                },
                groupsAssociatedToChannel: {},
                channelMemberCountsByGroup: {
                    current_channel_id: {},
                },
            },
            teams: {
                currentTeamId: 'current_team_id',
                teams: {
                    current_team_id: {
                        id: 'current_team_id',
                        group_constrained: false,
                    },
                },
                myMembers: {
                    current_team_id: {
                        roles: 'team_roles',
                    },
                },
                groupsAssociatedToTeam: {},
            },
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    current_user_id: {
                        id: 'current_user_id',
                        roles: 'user_roles',
                        locale: 'en',
                    },
                },
                statuses: {
                    current_user_id: 'online',
                },
            },
            roles: {
                roles: {
                    user_roles: {permissions: []},
                    channel_roles: {permissions: []},
                    team_roles: {permissions: []},
                },
            },
            groups: {
                groups: {},
            },
            emojis: {
                customEmoji: {},
            },
            preferences: {
                myPreferences: {},
            },
        },
        websocket: {
            connectionId: 'connection_id',
        },
    };

    function expectPosted(actions) {
        return expect(actions).toContainEqual(expect.objectContaining({
            type: 'MOCK_CREATE_POST',
        }));
    }

    function expectNotPosted(actions) {
        return expect(actions).not.toContainEqual(expect.objectContaining({
            type: 'MOCK_CREATE_POST',
        }));
    }

    ['channel', 'all', 'here'].forEach((mention) => {
        describe(`should not show Confirm Modal for @${mention} mentions`, () => {
            it('when channel member count too low', async () => {
                const testStore = await mockStore(mergeObjects(initialState, {
                    entities: {
                        general: {
                            config: {
                                EnableConfirmNotificationsToChannel: 'true',
                            },
                        },
                        roles: {
                            roles: {
                                user_roles: {permissions: [Permissions.USE_CHANNEL_MENTIONS]},
                            },
                        },
                        channels: {
                            stats: {
                                current_channel_id: {
                                    member_count: Constants.NOTIFY_ALL_MEMBERS - 1,
                                },
                            },
                        },
                    },
                }));
                const draft = {
                    ...baseDraft,
                    message: `Test message @${mention}`,
                };

                const result = await testStore.dispatch(handleSubmit(draft, () => null, () => null, null, ''));

                expect(result).toEqual({data: {submitting: true}});
                expectPosted(testStore.getActions());
            });

            it('when feature disabled', async () => {
                const testStore = await mockStore(mergeObjects(initialState, {
                    entities: {
                        general: {
                            config: {
                                EnableConfirmNotificationsToChannel: 'false',
                            },
                        },
                        roles: {
                            roles: {
                                user_roles: {permissions: [Permissions.USE_CHANNEL_MENTIONS]},
                            },
                        },
                        channels: {
                            stats: {
                                current_channel_id: {
                                    member_count: Constants.NOTIFY_ALL_MEMBERS + 1,
                                },
                            },
                        },
                    },
                }));
                const draft = {
                    ...baseDraft,
                    message: `Test message @${mention}`,
                };

                const result = await testStore.dispatch(handleSubmit(draft, () => null, () => null, null, ''));

                expect(result).toEqual({data: {submitting: true}});
                expectPosted(testStore.getActions());
            });

            it('when no mention', async () => {
                const testStore = await mockStore(mergeObjects(initialState, {
                    entities: {
                        general: {
                            config: {
                                EnableConfirmNotificationsToChannel: 'true',
                            },
                        },
                        roles: {
                            roles: {
                                user_roles: {permissions: [Permissions.USE_CHANNEL_MENTIONS]},
                            },
                        },
                        channels: {
                            stats: {
                                current_channel_id: {
                                    member_count: Constants.NOTIFY_ALL_MEMBERS + 1,
                                },
                            },
                        },
                    },
                }));
                const draft = {
                    ...baseDraft,
                    message: `Test message ${mention}`,
                };

                const result = await testStore.dispatch(handleSubmit(draft, () => null, () => null, null, ''));

                expect(result).toEqual({data: {submitting: true}});
                expectPosted(testStore.getActions());
            });

            it('when user has insufficient permissions', async () => {
                const testStore = await mockStore(mergeObjects(initialState, {
                    entities: {
                        general: {
                            config: {
                                EnableConfirmNotificationsToChannel: 'true',
                            },
                        },
                        roles: {
                            roles: {
                                user_roles: {permissions: []},
                            },
                        },
                        channels: {
                            stats: {
                                current_channel_id: {
                                    member_count: Constants.NOTIFY_ALL_MEMBERS + 1,
                                },
                            },
                        },
                    },
                }));
                const draft = {
                    ...baseDraft,
                    message: `Test message @${mention}`,
                };

                const result = await testStore.dispatch(handleSubmit(draft, () => null, () => null, null, ''));

                expect(result).toEqual({data: {submitting: true}});
                expectPosted(testStore.getActions());
            });
        });

        it(`should show Confirm Modal for @${mention} mentions when needed`, async () => {
            const testStore = await mockStore(mergeObjects(initialState, {
                entities: {
                    general: {
                        config: {
                            EnableConfirmNotificationsToChannel: 'true',
                        },
                    },
                    roles: {
                        roles: {
                            user_roles: {permissions: [Permissions.USE_CHANNEL_MENTIONS]},
                        },
                    },
                    channels: {
                        stats: {
                            current_channel_id: {
                                member_count: Constants.NOTIFY_ALL_MEMBERS + 1,
                            },
                        },
                    },
                },
            }));
            const draft = {
                ...baseDraft,
                message: `Test message @${mention}`,
            };

            const result = await testStore.dispatch(handleSubmit(draft, () => null, () => null, null, ''));

            expect(result).toEqual({data: {shouldClear: false}});
            const actions = testStore.getActions();
            expectNotPosted(actions);
            expect(actions).toContainEqual(expect.objectContaining({type: 'MODAL_OPEN'}));
        });

        it(`should show Confirm Modal for @${mention} mentions when needed and timezone notification`, async () => {
            const testStore = await mockStore(mergeObjects(initialState, {
                entities: {
                    general: {
                        config: {
                            EnableConfirmNotificationsToChannel: 'true',
                            ExperimentalTimezone: 'true',
                        },
                    },
                    roles: {
                        roles: {
                            user_roles: {permissions: [Permissions.USE_CHANNEL_MENTIONS]},
                        },
                    },
                    channels: {
                        stats: {
                            current_channel_id: {
                                member_count: Constants.NOTIFY_ALL_MEMBERS + 1,
                            },
                        },
                    },
                },
            }));
            const draft = {
                ...baseDraft,
                message: `Test message @${mention}`,
            };

            Client4.getChannelTimezones.mockResolvedValue(['tz1', 'tz2']);

            const result = await testStore.dispatch(handleSubmit(draft, () => null, () => null, null, ''));

            expect(result).toEqual({data: {shouldClear: false}});
            const actions = testStore.getActions();
            expectNotPosted(actions);
            expect(actions).toContainEqual(expect.objectContaining(
                {
                    type: 'MODAL_OPEN',
                    dialogProps: expect.objectContaining({channelTimezoneCount: 2}),
                },
            ));

            Client4.getChannelTimezones.mockResolvedValue([]);
        });

        it(`should show Confirm Modal for @${mention} mentions when needed and timezone notification`, async () => {
            const testStore = await mockStore(mergeObjects(initialState, {
                entities: {
                    general: {
                        config: {
                            EnableConfirmNotificationsToChannel: 'true',
                            ExperimentalTimezone: 'true',
                        },
                    },
                    roles: {
                        roles: {
                            user_roles: {permissions: [Permissions.USE_CHANNEL_MENTIONS]},
                        },
                    },
                    channels: {
                        stats: {
                            current_channel_id: {
                                member_count: Constants.NOTIFY_ALL_MEMBERS + 1,
                            },
                        },
                    },
                },
            }));
            const draft = {
                ...baseDraft,
                message: `Test message @${mention}`,
            };

            const result = await testStore.dispatch(handleSubmit(draft, () => null, () => null, null, ''));

            expect(result).toEqual({data: {shouldClear: false}});
            const actions = testStore.getActions();
            expectNotPosted(actions);
            expect(actions).toContainEqual(expect.objectContaining(
                {
                    type: 'MODAL_OPEN',
                    dialogProps: expect.objectContaining({channelTimezoneCount: 0}),
                },
            ));
        });
    });

    it('should show Confirm Modal for @group mention when needed and no timezone notification', async () => {
        const testStore = await mockStore(mergeObjects(initialState, {
            entities: {
                general: {
                    config: {
                        EnableConfirmNotificationsToChannel: 'true',
                        EnableCustomGroups: 'true',
                    },
                    license: {
                        IsLicensed: 'true',
                        LDAPGroups: 'true',
                    },
                },
                roles: {
                    roles: {
                        user_roles: {permissions: [Permissions.USE_GROUP_MENTIONS]},
                    },
                },
                groups: {
                    groups: {
                        developers: {
                            id: 'developers_id',
                            name: 'developers',
                            allow_reference: true,
                            delete_at: 0,
                            source: GroupSource.Ldap,
                        },
                    },
                },
                channels: {
                    channelMemberCountsByGroup: {
                        current_channel_id: {
                            developers_id: {
                                channel_member_count: Constants.NOTIFY_ALL_MEMBERS + 1,
                                channel_member_timezones_count: 0,
                            },
                        },
                    },
                },
            },
        }));
        const draft = {
            ...baseDraft,
            message: 'Test message @developers',
        };

        const result = await testStore.dispatch(handleSubmit(draft, () => null, () => null, null, ''));

        expect(result).toEqual({data: {shouldClear: false}});
        const actions = testStore.getActions();
        expectNotPosted(actions);
        expect(actions).toContainEqual(expect.objectContaining({type: 'MODAL_OPEN'}));
    });

    it('should show Confirm Modal for @group mention when needed and no timezone notification', async () => {
        const testStore = await mockStore(mergeObjects(initialState, {
            entities: {
                general: {
                    config: {
                        EnableConfirmNotificationsToChannel: 'true',
                        EnableCustomGroups: 'true',
                    },
                    license: {
                        IsLicensed: 'true',
                        LDAPGroups: 'true',
                    },
                },
                roles: {
                    roles: {
                        user_roles: {permissions: [Permissions.USE_GROUP_MENTIONS]},
                    },
                },
                groups: {
                    groups: {
                        developers: {
                            id: 'developers_id',
                            name: 'developers',
                            display_name: 'developers',
                            allow_reference: true,
                            delete_at: 0,
                            source: GroupSource.Ldap,
                        },
                        boss: {
                            id: 'boss_id',
                            name: 'boss',
                            display_name: 'boss',
                            allow_reference: true,
                            delete_at: 0,
                            source: GroupSource.Ldap,
                        },
                        love: {
                            id: 'love_id',
                            name: 'love',
                            display_name: 'love',
                            allow_reference: true,
                            delete_at: 0,
                            source: GroupSource.Ldap,
                        },
                        you: {
                            id: 'you_id',
                            name: 'you',
                            display_name: 'you',
                            allow_reference: true,
                            delete_at: 0,
                            source: GroupSource.Ldap,
                        },
                        software_developers: {
                            id: 'software_developers_id',
                            name: 'software_developers',
                            display_name: 'software_developers',
                            allow_reference: true,
                            delete_at: 0,
                            source: GroupSource.Ldap,
                        },
                    },
                },
                channels: {
                    channelMemberCountsByGroup: {
                        current_channel_id: {
                            developers_id: {
                                channel_member_count: 10,
                                channel_member_timezones_count: 0,
                            },
                            boss_id: {
                                channel_member_count: 20,
                                channel_member_timezones_count: 0,
                            },
                            love_id: {
                                channel_member_count: 30,
                                channel_member_timezones_count: 0,
                            },
                            you_id: {
                                channel_member_count: 40,
                                channel_member_timezones_count: 0,
                            },
                            software_developers_id: {
                                channel_member_count: 5,
                                channel_member_timezones_count: 0,
                            },
                        },
                    },
                },
            },
        }));
        const draft = {
            ...baseDraft,
            message: 'Test message @developers @boss @love @you @software-developers',
        };

        const result = await testStore.dispatch(handleSubmit(draft, () => null, () => null, null, ''));

        expect(result).toEqual({data: {shouldClear: false}});
        const actions = testStore.getActions();
        expectNotPosted(actions);
        expect(actions).toContainEqual(expect.objectContaining({
            type: 'MODAL_OPEN',
            dialogProps: expect.objectContaining({
                memberNotifyCount: 40,
                mentions: ['@developers', '@boss', '@love', '@you'],
            }),
        }));
    });

    it('should show Confirm Modal for @group mention with timezone enabled', async () => {
        const testStore = await mockStore(mergeObjects(initialState, {
            entities: {
                general: {
                    config: {
                        EnableConfirmNotificationsToChannel: 'true',
                        EnableCustomGroups: 'true',
                    },
                    license: {
                        IsLicensed: 'true',
                        LDAPGroups: 'true',
                    },
                },
                roles: {
                    roles: {
                        user_roles: {permissions: [Permissions.USE_GROUP_MENTIONS]},
                    },
                },
                groups: {
                    groups: {
                        developers: {
                            id: 'developers_id',
                            name: 'developers',
                            allow_reference: true,
                            delete_at: 0,
                            source: GroupSource.Ldap,
                        },
                    },
                },
                channels: {
                    channelMemberCountsByGroup: {
                        current_channel_id: {
                            developers_id: {
                                channel_member_count: Constants.NOTIFY_ALL_MEMBERS + 1,
                                channel_member_timezones_count: 5,
                            },
                        },
                    },
                },
            },
        }));
        const draft = {
            ...baseDraft,
            message: 'Test message @developers',
        };

        const result = await testStore.dispatch(handleSubmit(draft, () => null, () => null, null, ''));

        expect(result).toEqual({data: {shouldClear: false}});
        const actions = testStore.getActions();
        expectNotPosted(actions);
        expect(actions).toContainEqual(expect.objectContaining({
            type: 'MODAL_OPEN',
            dialogProps: expect.objectContaining({
                channelTimezoneCount: 5,
            }),
        }));
    });

    it('should allow to force send invalid slash command as a message', async () => {
        const message = '/invalid';
        const testStore = mockStore(initialState);
        const draft = {
            ...baseDraft,
            message,
        };
        const onSubmitted = jest.fn(() => {
            console.log('foo');
        });

        executeCommand.mockImplementation(() => () => ({error: {server_error_id: 'api.command.execute_command.not_found.app_error'}}));
        let result = await testStore.dispatch(handleSubmit(draft, () => null, onSubmitted, null, ''));
        await new Promise(process.nextTick);

        let actions = testStore.getActions();
        expect(onSubmitted).toHaveBeenCalledWith({
            error: {
                server_error_id: 'api.command.execute_command.not_found.app_error',
            }}, draft,
        );
        expect(result).toEqual({data: {submitting: true}});
        expectNotPosted(actions);

        testStore.clearActions();

        executeCommand.mockImplementation((...args) => ({type: 'MOCK_ACTIONS_COMMAND_EXECUTE', args}));

        result = await testStore.dispatch(handleSubmit(draft, () => null, onSubmitted, {submittedMessage: message, server_error_id: 'api.command.execute_command.not_found.app_error'}, ''));
        expect(result).toEqual({data: {submitting: true}});
        actions = testStore.getActions();
        expectPosted(actions);
    });

    ['channel', 'all', 'here'].forEach((mention) => {
        it(`should set mentionHighlightDisabled when user does not have permission and message contains channel @${mention}`, async () => {
            const testStore = mockStore(initialState);
            const draft = {
                ...baseDraft,
                message: `Test @${mention}`,
            };

            const result = await testStore.dispatch(handleSubmit(draft, () => null, () => null, null, ''));
            expect(result).toEqual({data: {submitting: true}});
            const actions = testStore.getActions();
            expectPosted(actions);
            expect(actions.find((v) => v.type === 'MOCK_CREATE_POST').args[0].props.mentionHighlightDisabled).toEqual(true);
        });

        it(`should not set mentionHighlightDisabled when user does have permission and message contains channel @${mention}`, async () => {
            const testStore = mockStore(mergeObjects(initialState, {
                entities: {
                    roles: {
                        roles: {
                            user_roles: {permissions: [Permissions.USE_CHANNEL_MENTIONS]},
                        },
                    },
                },
            }));
            const draft = {
                ...baseDraft,
                message: `Test @${mention}`,
            };

            const result = await testStore.dispatch(handleSubmit(draft, () => null, () => null, null, ''));
            expect(result).toEqual({data: {submitting: true}});
            const actions = testStore.getActions();
            expectPosted(actions);
            expect(actions.find((v) => v.type === 'MOCK_CREATE_POST').args[0].props.mentionHighlightDisabled).toBeFalsy();
        });
    });

    it('should not set mentionHighlightDisabled when user does not have useChannelMentions permission and message contains no mention', async () => {
        const testStore = mockStore(initialState);
        const draft = {
            ...baseDraft,
            message: 'Test message',
        };

        const result = await testStore.dispatch(handleSubmit(draft, () => null, () => null, null, ''));
        expect(result).toEqual({data: {submitting: true}});
        const actions = testStore.getActions();
        expectPosted(actions);
        expect(actions.find((v) => v.type === 'MOCK_CREATE_POST').args[0].props.mentionHighlightDisabled).toBeFalsy();
    });

    test('it adds message into history', async () => {
        const testStoreActual = mockStore(initialState);
        await testStoreActual.dispatch(handleSubmit(baseDraft, () => null, () => null, null));
        const actualActions = testStoreActual.getActions();

        const testStoreExpected = mockStore(initialState);
        await testStoreExpected.dispatch(addMessageIntoHistory(baseDraft.message));

        expect(actualActions).toEqual(
            expect.arrayContaining(testStoreExpected.getActions()),
        );

        expectPosted(actualActions);
    });

    test('it clears comment draft', async () => {
        const draft = {...baseDraft, rootId: 'rootId'};

        const testStoreActual = mockStore(initialState);
        await testStoreActual.dispatch(handleSubmit(draft, () => null, () => null, null));
        const actualActions = testStoreActual.getActions();

        const testStoreExpected = mockStore(initialState);
        const key = `${StoragePrefixes.COMMENT_DRAFT}${draft.rootId}`;
        await testStoreExpected.dispatch(removeDraft(key, draft.channelId, draft.rootId));

        expect(actualActions).toEqual(
            expect.arrayContaining(testStoreExpected.getActions()),
        );

        expectPosted(actualActions);
    });

    test('it submits a reaction when message is +:smile:', async () => {
        const draft = {...baseDraft, message: '+:smile:'};

        const testStoreActual = mockStore(initialState);
        await testStoreActual.dispatch(handleSubmit(draft, () => null, () => null, null, latestPostId));
        const actualActions = testStoreActual.getActions();

        const testStoreExpected = mockStore(initialState);
        await testStoreExpected.dispatch(submitReaction(latestPostId, '+', 'smile'));

        expect(actualActions).toEqual(
            expect.arrayContaining(testStoreExpected.getActions()),
        );

        expectNotPosted(actualActions);
    });

    test('it submits a command when message is /away', async () => {
        const draft = {...baseDraft, message: '/away'};

        const testStoreActual = mockStore(initialState);
        await testStoreActual.dispatch(handleSubmit(draft, () => null, () => null, null));
        const actualActions = testStoreActual.getActions();

        const testStoreExpected = mockStore(initialState);
        testStoreExpected.dispatch(submitCommand(channelId, rootId, draft));

        expect(actualActions).toEqual(
            expect.arrayContaining(testStoreExpected.getActions()),
        );

        expectNotPosted(actualActions);
    });

    test('it submits a regular post when we pass the execute command error', async () => {
        const draft = {...baseDraft, message: '/fakecommand'};

        const testStore = mockStore(initialState);
        await testStore.dispatch(handleSubmit(draft, () => null, () => null, {server_error_id: 'api.command.execute_command.not_found.app_error', submittedMessage: draft.message}));

        expect(testStore.getActions()).toContainEqual(expect.objectContaining({
            type: 'MOCK_CREATE_POST',
            args: expect.arrayContaining([expect.objectContaining({message: draft.message})]),
        }));
    });

    test('it submits a regular post when message is something else', async () => {
        const draft = {...baseDraft, message: 'some text'};

        const testStore = mockStore(initialState);
        await testStore.dispatch(handleSubmit(draft, () => null, () => null, null));

        expect(testStore.getActions()).toContainEqual(expect.objectContaining({
            type: 'MOCK_CREATE_POST',
            args: expect.arrayContaining([expect.objectContaining({message: draft.message})]),
        }));
    });
});
