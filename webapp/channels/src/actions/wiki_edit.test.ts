// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

import * as PageDraftActions from 'actions/page_drafts';
import * as PageDraftSelectors from 'selectors/page_drafts';

import {openPageInEditMode} from './wiki_edit';

jest.mock('actions/page_drafts');
jest.mock('selectors/page_drafts');

const mockSavePageDraft = PageDraftActions.savePageDraft as jest.MockedFunction<typeof PageDraftActions.savePageDraft>;
const mockHasUnsavedChanges = PageDraftSelectors.hasUnsavedChanges as jest.MockedFunction<typeof PageDraftSelectors.hasUnsavedChanges>;
const mockGetPageDraft = PageDraftSelectors.getPageDraft as jest.MockedFunction<typeof PageDraftSelectors.getPageDraft>;

describe('wiki_edit actions', () => {
    const channelId = 'channel123';
    const wikiId = 'wiki123';
    const pageId = 'page123';

    const mockPage: Post = {
        id: pageId,
        create_at: 1000000000000,
        update_at: 1000000100000,
        edit_at: 1000000100000,
        delete_at: 0,
        is_pinned: false,
        user_id: 'user123',
        channel_id: channelId,
        root_id: '',
        original_id: '',
        message: '{"type":"doc","content":[]}',
        type: 'page',
        props: {
            title: 'Test Page',
            page_status: 'In Progress',
        },
        page_parent_id: 'parent123',
        hashtags: '',
        pending_post_id: '',
        reply_count: 0,
        metadata: {
            embeds: [],
            emojis: [],
            files: [],
            images: {},
        },
    };

    const mockState = {
        entities: {
            users: {currentUserId: 'user123'},
        },
        storage: {storage: {}},
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('openPageInEditMode', () => {
        test('should save draft and return pageId on success', async () => {
            mockHasUnsavedChanges.mockReturnValue(false);
            mockSavePageDraft.mockReturnValue(() => Promise.resolve({data: true}) as any);

            const dispatch: jest.Mock = jest.fn((action) => {
                if (typeof action === 'function') {
                    return action(dispatch, () => mockState);
                }
                return action;
            });
            const getState = jest.fn((): any => mockState);

            const action = openPageInEditMode(channelId, wikiId, mockPage);
            const result = await action(dispatch, getState, undefined);

            expect(result.data).toBe(pageId);
            expect(result.error).toBeUndefined();
        });

        test('should call savePageDraft with correct parameters', async () => {
            mockHasUnsavedChanges.mockReturnValue(false);
            mockSavePageDraft.mockReturnValue(() => Promise.resolve({data: true}) as any);

            const dispatch: jest.Mock = jest.fn((action) => {
                if (typeof action === 'function') {
                    return action(dispatch, () => mockState);
                }
                return action;
            });
            const getState = jest.fn((): any => mockState);

            const action = openPageInEditMode(channelId, wikiId, mockPage);
            await action(dispatch, getState, undefined);

            expect(mockSavePageDraft).toHaveBeenCalledWith(
                channelId,
                wikiId,
                pageId,
                mockPage.message,
                'Test Page',
                undefined,
                expect.objectContaining({
                    page_id: pageId,
                    original_page_edit_at: mockPage.edit_at,
                    has_published_version: true,
                    page_parent_id: 'parent123',
                    page_status: 'In Progress',
                }),
            );
        });

        test('should include page_parent_id in additionalProps when present', async () => {
            mockHasUnsavedChanges.mockReturnValue(false);
            mockSavePageDraft.mockReturnValue(() => Promise.resolve({data: true}) as any);

            const dispatch: jest.Mock = jest.fn((action) => {
                if (typeof action === 'function') {
                    return action(dispatch, () => mockState);
                }
                return action;
            });
            const getState = jest.fn((): any => mockState);

            const action = openPageInEditMode(channelId, wikiId, mockPage);
            await action(dispatch, getState, undefined);

            const callArgs = mockSavePageDraft.mock.calls[0];
            const additionalProps = callArgs[6];
            expect(additionalProps!.page_parent_id).toBe('parent123');
        });

        test('should not include page_parent_id when not present', async () => {
            mockHasUnsavedChanges.mockReturnValue(false);
            mockSavePageDraft.mockReturnValue(() => Promise.resolve({data: true}) as any);

            const pageWithoutParent = {...mockPage, page_parent_id: ''};

            const dispatch: jest.Mock = jest.fn((action) => {
                if (typeof action === 'function') {
                    return action(dispatch, () => mockState);
                }
                return action;
            });
            const getState = jest.fn((): any => mockState);

            const action = openPageInEditMode(channelId, wikiId, pageWithoutParent);
            await action(dispatch, getState, undefined);

            const callArgs = mockSavePageDraft.mock.calls[0];
            const additionalProps = callArgs[6];
            expect(additionalProps!.page_parent_id).toBeUndefined();
        });

        test('should include page_status in additionalProps when present', async () => {
            mockHasUnsavedChanges.mockReturnValue(false);
            mockSavePageDraft.mockReturnValue(() => Promise.resolve({data: true}) as any);

            const dispatch: jest.Mock = jest.fn((action) => {
                if (typeof action === 'function') {
                    return action(dispatch, () => mockState);
                }
                return action;
            });
            const getState = jest.fn((): any => mockState);

            const action = openPageInEditMode(channelId, wikiId, mockPage);
            await action(dispatch, getState, undefined);

            const callArgs = mockSavePageDraft.mock.calls[0];
            const additionalProps = callArgs[6];
            expect(additionalProps!.page_status).toBe('In Progress');
        });

        test('should return error when unsaved draft exists', async () => {
            const existingDraft = {
                message: 'existing content',
                createAt: 1000,
            };

            mockHasUnsavedChanges.mockReturnValue(true);
            mockGetPageDraft.mockReturnValue(existingDraft as any);

            const dispatch = jest.fn();
            const getState = jest.fn((): any => mockState);

            const action = openPageInEditMode(channelId, wikiId, mockPage);
            const result = await action(dispatch, getState, undefined);

            expect(result.error).toBeDefined();
            expect(result.error.id).toBe('api.page.edit.unsaved_draft_exists');
            expect(result.error.message).toBe('You have unsaved changes in a previous draft');
            expect(result.error.data.existingDraft).toEqual(existingDraft);
            expect(result.error.data.draftCreateAt).toBe(1000);
            expect(result.error.data.requiresConfirmation).toBe(true);
        });

        test('should not return error when hasUnsavedChanges returns false', async () => {
            mockHasUnsavedChanges.mockReturnValue(false);
            mockSavePageDraft.mockReturnValue(() => Promise.resolve({data: true}) as any);

            const dispatch: jest.Mock = jest.fn((action) => {
                if (typeof action === 'function') {
                    return action(dispatch, () => mockState);
                }
                return action;
            });
            const getState = jest.fn((): any => mockState);

            const action = openPageInEditMode(channelId, wikiId, mockPage);
            const result = await action(dispatch, getState, undefined);

            expect(result.error).toBeUndefined();
            expect(mockSavePageDraft).toHaveBeenCalled();
        });

        test('should not return error when no draft exists even if hasUnsavedChanges is true', async () => {
            mockHasUnsavedChanges.mockReturnValue(true);
            mockGetPageDraft.mockReturnValue(null);
            mockSavePageDraft.mockReturnValue(() => Promise.resolve({data: true}) as any);

            const dispatch: jest.Mock = jest.fn((action) => {
                if (typeof action === 'function') {
                    return action(dispatch, () => mockState);
                }
                return action;
            });
            const getState = jest.fn((): any => mockState);

            const action = openPageInEditMode(channelId, wikiId, mockPage);
            const result = await action(dispatch, getState, undefined);

            expect(result.error).toBeUndefined();
        });

        test('should return error when savePageDraft fails', async () => {
            mockHasUnsavedChanges.mockReturnValue(false);
            mockSavePageDraft.mockReturnValue(() => Promise.resolve({error: {message: 'Save failed'}}) as any);

            const dispatch: jest.Mock = jest.fn((action) => {
                if (typeof action === 'function') {
                    return action(dispatch, () => mockState);
                }
                return action;
            });
            const getState = jest.fn((): any => mockState);

            const action = openPageInEditMode(channelId, wikiId, mockPage);
            const result = await action(dispatch, getState, undefined);

            expect(result.error).toBeDefined();
            expect(result.error.message).toBe('Save failed');
        });

        test('should use Untitled page as title when page has no title', async () => {
            mockHasUnsavedChanges.mockReturnValue(false);
            mockSavePageDraft.mockReturnValue(() => Promise.resolve({data: true}) as any);

            const pageWithoutTitle = {...mockPage, props: {}};

            const dispatch: jest.Mock = jest.fn((action) => {
                if (typeof action === 'function') {
                    return action(dispatch, () => mockState);
                }
                return action;
            });
            const getState = jest.fn((): any => mockState);

            const action = openPageInEditMode(channelId, wikiId, pageWithoutTitle);
            await action(dispatch, getState, undefined);

            const callArgs = mockSavePageDraft.mock.calls[0];
            const title = callArgs[4];
            expect(title).toBe('Untitled page');
        });

        test('should set has_published_version to true', async () => {
            mockHasUnsavedChanges.mockReturnValue(false);
            mockSavePageDraft.mockReturnValue(() => Promise.resolve({data: true}) as any);

            const dispatch: jest.Mock = jest.fn((action) => {
                if (typeof action === 'function') {
                    return action(dispatch, () => mockState);
                }
                return action;
            });
            const getState = jest.fn((): any => mockState);

            const action = openPageInEditMode(channelId, wikiId, mockPage);
            await action(dispatch, getState, undefined);

            const callArgs = mockSavePageDraft.mock.calls[0];
            const additionalProps = callArgs[6];
            expect(additionalProps!.has_published_version).toBe(true);
        });

        test('should set original_page_edit_at from page.edit_at', async () => {
            mockHasUnsavedChanges.mockReturnValue(false);
            mockSavePageDraft.mockReturnValue(() => Promise.resolve({data: true}) as any);

            const dispatch: jest.Mock = jest.fn((action) => {
                if (typeof action === 'function') {
                    return action(dispatch, () => mockState);
                }
                return action;
            });
            const getState = jest.fn((): any => mockState);

            const action = openPageInEditMode(channelId, wikiId, mockPage);
            await action(dispatch, getState, undefined);

            const callArgs = mockSavePageDraft.mock.calls[0];
            const additionalProps = callArgs[6];
            expect(additionalProps!.original_page_edit_at).toBe(mockPage.edit_at);
        });
    });
});
