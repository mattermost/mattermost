// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {WikiTypes} from 'mattermost-redux/action_types';
import * as WikiActions from 'mattermost-redux/actions/wikis';

import * as StorageActions from 'actions/storage';
import * as DraftActions from 'actions/views/drafts';

import {
    savePageDraft,
    fetchPageDraft,
    fetchPageDraftsForWiki,
    removePageDraft,
    clearPageDraft,
    transformPageServerDraft,
} from './page_drafts';

jest.mock('mattermost-redux/actions/wikis');
jest.mock('actions/storage');
jest.mock('actions/views/drafts');

const mockWikiSavePageDraft = WikiActions.savePageDraft as jest.MockedFunction<typeof WikiActions.savePageDraft>;
const mockWikiDeletePageDraft = WikiActions.deletePageDraft as jest.MockedFunction<typeof WikiActions.deletePageDraft>;
const mockWikiGetPageDraftsForWiki = WikiActions.getPageDraftsForWiki as jest.MockedFunction<typeof WikiActions.getPageDraftsForWiki>;
const mockSetGlobalItem = StorageActions.setGlobalItem as jest.MockedFunction<typeof StorageActions.setGlobalItem>;
const mockRemoveGlobalItem = StorageActions.removeGlobalItem as jest.MockedFunction<typeof StorageActions.removeGlobalItem>;
const mockSetGlobalDraftSource = DraftActions.setGlobalDraftSource as jest.MockedFunction<typeof DraftActions.setGlobalDraftSource>;

describe('page_drafts actions', () => {
    const channelId = 'channel123';
    const wikiId = 'wiki123';
    const pageId = 'page123';
    const userId = 'user123';
    const message = '{"type":"doc","content":[]}';
    const title = 'Test Page';

    const createMockState = (options: {syncEnabled?: boolean; existingDraft?: any} = {}) => ({
        entities: {
            users: {
                currentUserId: userId,
            },
            preferences: {
                myPreferences: options.syncEnabled ? {
                    'drafts--sync_drafts': {value: 'true'},
                } : {},
            },
            general: {
                config: {
                    AllowSyncedDrafts: options.syncEnabled ? 'true' : 'false',
                },
            },
        },
        storage: {
            storage: options.existingDraft ? {
                [`page_draft_${wikiId}_${pageId}_${userId}`]: {
                    value: options.existingDraft,
                },
            } : {},
        },
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('transformPageServerDraft', () => {
        test('should transform server draft to local draft format', () => {
            const serverDraft = {
                wiki_id: wikiId,
                page_id: pageId,
                user_id: userId,
                content: {type: 'doc', content: []},
                title: 'Server Title',
                create_at: 1000,
                update_at: 2000,
                props: {custom: 'prop'},
                has_published_version: true,
            };

            const result = transformPageServerDraft(serverDraft as any, wikiId, pageId, userId);

            expect(result.key).toBe(`page_draft_${wikiId}_${pageId}_${userId}`);
            expect(result.timestamp).toEqual(new Date(2000));
            expect(result.value.message).toBe(JSON.stringify(serverDraft.content));
            expect(result.value.props.title).toBe('Server Title');
            expect(result.value.props.custom).toBe('prop');
            expect(result.value.props.has_published_version).toBe(true);
            expect(result.value.wikiId).toBe(wikiId);
            expect(result.value.rootId).toBe(pageId);
            expect(result.value.createAt).toBe(1000);
            expect(result.value.updateAt).toBe(2000);
        });

        test('should handle file_ids in server draft', () => {
            const serverDraft = {
                wiki_id: wikiId,
                page_id: pageId,
                user_id: userId,
                content: {},
                title: '',
                create_at: 1000,
                update_at: 2000,
                props: {},
                file_ids: ['file1', 'file2'],
            };

            const result = transformPageServerDraft(serverDraft as any, wikiId, pageId, userId);

            expect(result.value.props.file_ids).toEqual(['file1', 'file2']);
        });
    });

    describe('savePageDraft', () => {
        test('should save draft to local storage', async () => {
            const dispatch = jest.fn();
            const getState = jest.fn(() => createMockState({syncEnabled: false})) as any;

            mockSetGlobalItem.mockReturnValue({type: 'SET_GLOBAL_ITEM'} as any);
            mockSetGlobalDraftSource.mockReturnValue({type: 'SET_DRAFT_SOURCE'} as any);

            const action = savePageDraft(channelId, wikiId, pageId, message, title);
            const result = await action(dispatch, getState, undefined);

            expect(result.data).toBe(true);
            expect(mockSetGlobalItem).toHaveBeenCalled();
            expect(mockSetGlobalDraftSource).toHaveBeenCalled();
            expect(dispatch).toHaveBeenCalled();
        });

        test('should sync with server when sync is enabled', async () => {
            const dispatch: jest.Mock = jest.fn((action) => {
                if (typeof action === 'function') {
                    return action(dispatch, jest.fn(() => createMockState({syncEnabled: true})), undefined);
                }
                return action;
            });
            const getState = jest.fn(() => createMockState({syncEnabled: true})) as any;

            mockSetGlobalItem.mockReturnValue({type: 'SET_GLOBAL_ITEM'} as any);
            mockSetGlobalDraftSource.mockReturnValue({type: 'SET_DRAFT_SOURCE'} as any);
            mockWikiSavePageDraft.mockReturnValue(() => Promise.resolve({
                data: {
                    wiki_id: wikiId,
                    page_id: pageId,
                    content: {},
                    title,
                    create_at: 1000,
                    update_at: 2000,
                    props: {},
                },
            }) as any);

            const action = savePageDraft(channelId, wikiId, pageId, message, title);
            const result = await action(dispatch, getState, undefined);

            expect(result.data).toBe(true);
            expect(mockWikiSavePageDraft).toHaveBeenCalledWith(wikiId, pageId, message, title, undefined, undefined);
        });

        test('should preserve existing draft props', async () => {
            const existingDraft = {
                message: 'old content',
                props: {existing_prop: 'value'},
                createAt: 500,
            };

            const dispatch = jest.fn();
            const getState = jest.fn(() => createMockState({syncEnabled: false, existingDraft})) as any;

            mockSetGlobalItem.mockReturnValue({type: 'SET_GLOBAL_ITEM'} as any);
            mockSetGlobalDraftSource.mockReturnValue({type: 'SET_DRAFT_SOURCE'} as any);

            const action = savePageDraft(channelId, wikiId, pageId, message, title);
            await action(dispatch, getState, undefined);

            const savedDraft = mockSetGlobalItem.mock.calls[0][1];
            expect(savedDraft.props.existing_prop).toBe('value');
            expect(savedDraft.createAt).toBe(500);
        });

        test('should include additional props when provided', async () => {
            const dispatch = jest.fn();
            const getState = jest.fn(() => createMockState({syncEnabled: false})) as any;

            mockSetGlobalItem.mockReturnValue({type: 'SET_GLOBAL_ITEM'} as any);
            mockSetGlobalDraftSource.mockReturnValue({type: 'SET_DRAFT_SOURCE'} as any);

            const additionalProps = {page_parent_id: 'parent123'};
            const action = savePageDraft(channelId, wikiId, pageId, message, title, undefined, additionalProps);
            await action(dispatch, getState, undefined);

            const savedDraft = mockSetGlobalItem.mock.calls[0][1];
            expect(savedDraft.props.page_parent_id).toBe('parent123');
        });

        test('should return error when server sync fails', async () => {
            const dispatch: jest.Mock = jest.fn((action) => {
                if (typeof action === 'function') {
                    return action(dispatch, jest.fn(() => createMockState({syncEnabled: true})), undefined);
                }
                return action;
            });
            const getState = jest.fn(() => createMockState({syncEnabled: true})) as any;

            mockSetGlobalItem.mockReturnValue({type: 'SET_GLOBAL_ITEM'} as any);
            mockSetGlobalDraftSource.mockReturnValue({type: 'SET_DRAFT_SOURCE'} as any);
            mockWikiSavePageDraft.mockReturnValue(() => Promise.resolve({
                error: {message: 'Server error'},
            }) as any);

            const action = savePageDraft(channelId, wikiId, pageId, message, title);
            const result = await action(dispatch, getState, undefined);

            expect(result.error).toBeDefined();
            expect(result.data).toBe(false);
        });
    });

    describe('fetchPageDraft', () => {
        test('should return draft from storage', async () => {
            const storedDraft = {
                message,
                props: {title},
                channelId,
            };

            const dispatch = jest.fn();
            const getState = jest.fn((): any => ({
                entities: {
                    users: {currentUserId: userId},
                },
                storage: {
                    storage: {
                        [`page_draft_${wikiId}_${pageId}_${userId}`]: {value: storedDraft},
                    },
                },
            }));

            const action = fetchPageDraft(wikiId, pageId);
            const result = await action(dispatch, getState, undefined);

            expect(result.data).toEqual(storedDraft);
        });

        test('should return null when no draft exists', async () => {
            const dispatch = jest.fn();
            const getState = jest.fn((): any => ({
                entities: {
                    users: {currentUserId: userId},
                },
                storage: {
                    storage: {},
                },
            }));

            const action = fetchPageDraft(wikiId, pageId);
            const result = await action(dispatch, getState, undefined);

            expect(result.data).toBeNull();
        });
    });

    describe('removePageDraft', () => {
        test('should remove draft from local storage', async () => {
            const dispatch = jest.fn();
            const getState = jest.fn(() => createMockState({syncEnabled: false})) as any;

            mockRemoveGlobalItem.mockReturnValue({type: 'REMOVE_GLOBAL_ITEM'} as any);

            const action = removePageDraft(wikiId, pageId);
            const result = await action(dispatch, getState, undefined);

            expect(result.data).toBe(true);
            expect(mockRemoveGlobalItem).toHaveBeenCalledWith(`page_draft_${wikiId}_${pageId}_${userId}`);
        });

        test('should delete from server when sync is enabled', async () => {
            const dispatch: jest.Mock = jest.fn((action) => {
                if (typeof action === 'function') {
                    return action(dispatch, jest.fn(() => createMockState({syncEnabled: true})), undefined);
                }
                return action;
            });
            const getState = jest.fn(() => createMockState({syncEnabled: true})) as any;

            mockRemoveGlobalItem.mockReturnValue({type: 'REMOVE_GLOBAL_ITEM'} as any);
            mockWikiDeletePageDraft.mockReturnValue(() => Promise.resolve({data: true}) as any);

            const action = removePageDraft(wikiId, pageId);
            await action(dispatch, getState, undefined);

            expect(mockWikiDeletePageDraft).toHaveBeenCalledWith(wikiId, pageId);
        });

        test('should dispatch DELETED_DRAFT action', async () => {
            const dispatch = jest.fn();
            const getState = jest.fn(() => createMockState({syncEnabled: false})) as any;

            mockRemoveGlobalItem.mockReturnValue({type: 'REMOVE_GLOBAL_ITEM'} as any);

            const action = removePageDraft(wikiId, pageId);
            await action(dispatch, getState, undefined);

            // First dispatch is DRAFT_DELETION_RECORDED (recorded before API call)
            const deletionRecordedCall = dispatch.mock.calls[0][0];
            expect(deletionRecordedCall.type).toBe(WikiTypes.DRAFT_DELETION_RECORDED);
            expect(deletionRecordedCall.data.draftId).toBe(pageId);
            expect(typeof deletionRecordedCall.data.deletedAt).toBe('number');

            // Second dispatch is batch actions including DELETED_DRAFT
            const batchCall = dispatch.mock.calls[1][0];
            expect(batchCall.payload).toContainEqual({
                type: WikiTypes.DELETED_DRAFT,
                data: {id: pageId, wikiId, userId},
            });
        });

        test('should revert tombstone and return error when server delete fails', async () => {
            const mockError = {message: 'Server error'};
            const dispatchedActions: any[] = [];
            const dispatch: jest.Mock = jest.fn((action) => {
                if (typeof action === 'function') {
                    return action(dispatch, jest.fn(() => createMockState({syncEnabled: true})), undefined);
                }
                dispatchedActions.push(action);
                return action;
            });
            const getState = jest.fn(() => createMockState({syncEnabled: true})) as any;

            mockRemoveGlobalItem.mockReturnValue({type: 'REMOVE_GLOBAL_ITEM'} as any);
            mockWikiDeletePageDraft.mockReturnValue(() => Promise.resolve({error: mockError}) as any);

            const action = removePageDraft(wikiId, pageId);
            const result = await action(dispatch, getState, undefined);

            // Should return error
            expect(result.data).toBe(false);
            expect(result.error).toBe(mockError);

            // Should dispatch DRAFT_DELETION_RECORDED first
            const recordedAction = dispatchedActions.find((a) => a.type === WikiTypes.DRAFT_DELETION_RECORDED);
            expect(recordedAction).toBeDefined();
            expect(recordedAction.data.draftId).toBe(pageId);

            // Should dispatch DRAFT_DELETION_REVERTED when API fails
            const revertedAction = dispatchedActions.find((a) => a.type === WikiTypes.DRAFT_DELETION_REVERTED);
            expect(revertedAction).toBeDefined();
            expect(revertedAction.data.draftId).toBe(pageId);

            // Should NOT remove from local storage when API fails
            expect(mockRemoveGlobalItem).not.toHaveBeenCalled();
        });
    });

    describe('clearPageDraft', () => {
        test('should delegate to removePageDraft', async () => {
            const dispatch: jest.Mock = jest.fn((action) => {
                if (typeof action === 'function') {
                    return action(dispatch, jest.fn(() => createMockState({syncEnabled: false})), undefined);
                }
                return {data: true};
            });

            mockRemoveGlobalItem.mockReturnValue({type: 'REMOVE_GLOBAL_ITEM'} as any);

            const action = clearPageDraft(wikiId, pageId);
            const result = await action(dispatch, jest.fn(), undefined);

            expect(result.data).toBe(true);
        });
    });

    describe('fetchPageDraftsForWiki', () => {
        test('should return drafts from local storage', async () => {
            const localDraft = {
                message: '{"type":"doc"}',
                props: {title: 'Local Draft'},
                updateAt: 1000,
            };

            const dispatch = jest.fn();
            const getState = jest.fn((): any => ({
                entities: {
                    users: {currentUserId: userId},
                    preferences: {myPreferences: {}},
                    general: {config: {AllowSyncedDrafts: 'false'}},
                },
                storage: {
                    storage: {
                        [`page_draft_${wikiId}_page1_${userId}`]: {value: localDraft},
                    },
                },
            }));

            mockSetGlobalItem.mockReturnValue({type: 'SET_GLOBAL_ITEM'} as any);

            const action = fetchPageDraftsForWiki(wikiId);
            const result = await action(dispatch, getState, undefined);

            expect(result.data).toHaveLength(1);
            expect(result.data![0]).toEqual(localDraft);
        });

        test('should merge server and local drafts, keeping newer', async () => {
            const olderLocalDraft = {
                message: '{"type":"doc"}',
                props: {title: 'Old Local'},
                updateAt: 1000,
            };

            const dispatch: jest.Mock = jest.fn((action) => {
                if (typeof action === 'function') {
                    return action(dispatch, jest.fn(() => ({
                        entities: {
                            users: {currentUserId: userId},
                            preferences: {myPreferences: {'drafts--sync_drafts': {value: 'true'}}},
                            general: {config: {AllowSyncedDrafts: 'true'}},
                        },
                        storage: {
                            storage: {
                                [`page_draft_${wikiId}_page1_${userId}`]: {value: olderLocalDraft},
                            },
                        },
                    })), undefined);
                }
                return action;
            });
            const getState = jest.fn((): any => ({
                entities: {
                    users: {currentUserId: userId},
                    preferences: {myPreferences: {'drafts--sync_drafts': {value: 'true'}}},
                    general: {config: {AllowSyncedDrafts: 'true'}},
                },
                storage: {
                    storage: {
                        [`page_draft_${wikiId}_page1_${userId}`]: {value: olderLocalDraft},
                    },
                },
            }));

            mockSetGlobalItem.mockReturnValue({type: 'SET_GLOBAL_ITEM'} as any);
            mockWikiGetPageDraftsForWiki.mockReturnValue(() => Promise.resolve({
                data: [{
                    wiki_id: wikiId,
                    page_id: 'page1',
                    content: {type: 'doc'},
                    title: 'Newer Server',
                    create_at: 500,
                    update_at: 2000,
                    props: {},
                }],
            }) as any);

            const action = fetchPageDraftsForWiki(wikiId);
            const result = await action(dispatch, getState, undefined);

            // Should return the server draft (newer)
            expect(result.data).toHaveLength(1);
            expect(result.data![0].props.title).toBe('Newer Server');
        });

        test('should only include drafts for current user', async () => {
            const dispatch = jest.fn();
            const getState = jest.fn((): any => ({
                entities: {
                    users: {currentUserId: userId},
                    preferences: {myPreferences: {}},
                    general: {config: {AllowSyncedDrafts: 'false'}},
                },
                storage: {
                    storage: {
                        [`page_draft_${wikiId}_page1_${userId}`]: {value: {message: 'mine', updateAt: 1000}},
                        [`page_draft_${wikiId}_page2_otheruser`]: {value: {message: 'not mine', updateAt: 1000}},
                    },
                },
            }));

            mockSetGlobalItem.mockReturnValue({type: 'SET_GLOBAL_ITEM'} as any);

            const action = fetchPageDraftsForWiki(wikiId);
            const result = await action(dispatch, getState, undefined);

            expect(result.data).toHaveLength(1);
            expect(result.data![0].message).toBe('mine');
        });
    });
});
