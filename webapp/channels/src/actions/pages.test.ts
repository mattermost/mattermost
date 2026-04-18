// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {WikiTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';

import * as Actions from 'actions/pages';

import {makeInitialPagesState} from 'tests/helpers/pages_state';
import mockStore from 'tests/test_store';
import {PagePropsKeys} from 'utils/constants';

jest.mock('mattermost-redux/client');

describe('actions/pages - Page Status', () => {
    let testStore: ReturnType<typeof mockStore>;

    beforeEach(() => {
        testStore = mockStore({
            entities: {
                pages: makeInitialPagesState(),
                posts: {
                    posts: {},
                },
                users: {
                    currentUserId: 'test_user_id',
                },
            },
        });
        jest.clearAllMocks();
    });

    describe('fetchPageStatusField', () => {
        test('should fetch page status field successfully', async () => {
            const mockField = {
                id: 'status_field_id',
                name: 'status',
                type: 'select',
                attrs: {
                    options: [
                        {id: 'rough_draft', name: 'Rough draft', color: 'light_grey'},
                        {id: 'in_progress', name: 'In progress', color: 'light_blue'},
                        {id: 'in_review', name: 'In review', color: 'dark_blue'},
                        {id: 'done', name: 'Done', color: 'green'},
                    ],
                },
            };

            (Client4.getPageStatusField as jest.Mock).mockResolvedValue(mockField);

            await testStore.dispatch(Actions.fetchPageStatusField());

            const actions = testStore.getActions();
            expect(actions).toHaveLength(1);
            expect(actions[0]).toEqual({
                type: WikiTypes.RECEIVED_PAGE_STATUS_FIELD,
                data: mockField,
            });
        });

        test('should handle error when fetching page status field fails', async () => {
            const error = new Error('Failed to fetch status field');
            (Client4.getPageStatusField as jest.Mock).mockRejectedValue(error);

            const result = await testStore.dispatch(Actions.fetchPageStatusField());

            expect(result.error).toBeTruthy();
        });
    });

    describe('updatePageStatus', () => {
        test('should update page status successfully', async () => {
            const postId = 'test_post_id';
            const wikiId = 'test_wiki_id';
            const status = 'Done';
            const mockPost = {
                id: postId,
                props: {title: 'Test Page', wiki_id: wikiId},
            };

            testStore.getState().entities.pages.byId = {[postId]: mockPost as any};
            (Client4.updatePageStatus as jest.Mock).mockResolvedValue({});

            await testStore.dispatch(Actions.updatePageStatus(postId, status, wikiId));

            const actions = testStore.getActions();
            expect(actions).toHaveLength(1);
            expect(actions[0].type).toBe('RECEIVED_PAGE');
            expect(actions[0].data.page.id).toBe(postId);
            expect(actions[0].data.page.props.page_status).toBe(status);
        });

        test('should handle error when updating page status fails', async () => {
            const postId = 'test_post_id';
            const status = 'Done';
            const wikiId = 'test_wiki_id';
            const error = new Error('Failed to update status');
            (Client4.updatePageStatus as jest.Mock).mockRejectedValue(error);

            const result = await testStore.dispatch(Actions.updatePageStatus(postId, status, wikiId));

            expect(result.error).toBeTruthy();
        });

        test('should update with all valid status values', async () => {
            const postId = 'test_post_id';
            const wikiId = 'test_wiki_id';
            const validStatuses = ['Rough draft', 'In progress', 'In review', 'Done'];
            const mockPost = {
                id: postId,
                props: {title: 'Test Page', wiki_id: wikiId},
            };

            testStore.getState().entities.pages.byId = {[postId]: mockPost as any};
            (Client4.updatePageStatus as jest.Mock).mockResolvedValue({});

            for (const status of validStatuses) {
                testStore.clearActions();
                // eslint-disable-next-line no-await-in-loop
                await testStore.dispatch(Actions.updatePageStatus(postId, status, wikiId));
                const actions = testStore.getActions();

                expect(actions).toHaveLength(1);
                expect(actions[0].type).toBe('RECEIVED_PAGE');
                expect(actions[0].data.page.props.page_status).toBe(status);
            }
        });
    });
});

describe('actions/pages - Translation Metadata', () => {
    let testStore: ReturnType<typeof mockStore>;

    beforeEach(() => {
        testStore = mockStore({
            entities: {
                pages: makeInitialPagesState(),
                posts: {
                    posts: {},
                },
                users: {
                    currentUserId: 'test_user_id',
                },
            },
        });
        jest.clearAllMocks();
    });

    describe('setPageTranslationMetadata', () => {
        test('should set translation metadata on a page', async () => {
            const pageId = 'translated_page_id';
            const sourcePageId = 'source_page_id';
            const languageCode = 'es';
            const wikiId = 'wiki_id_1';
            const mockPage = {
                id: pageId,
                type: 'page',
                props: {title: 'Test Page', [PagePropsKeys.WIKI_ID]: wikiId},
            };
            const mockUpdatedPage = {
                ...mockPage,
                props: {
                    ...mockPage.props,
                    [PagePropsKeys.TRANSLATED_FROM]: sourcePageId,
                    [PagePropsKeys.TRANSLATION_LANGUAGE]: languageCode,
                },
            };

            testStore.getState().entities.pages.byId = {[pageId]: mockPage as any};
            (Client4.patchPost as jest.Mock).mockResolvedValue(mockUpdatedPage);

            await testStore.dispatch(Actions.setPageTranslationMetadata(pageId, sourcePageId, languageCode));

            expect(Client4.patchPost).toHaveBeenCalledWith({
                id: pageId,
                props: {
                    title: 'Test Page',
                    [PagePropsKeys.WIKI_ID]: wikiId,
                    [PagePropsKeys.TRANSLATED_FROM]: sourcePageId,
                    [PagePropsKeys.TRANSLATION_LANGUAGE]: languageCode,
                },
            });

            const actions = testStore.getActions();
            expect(actions).toHaveLength(1);
            expect(actions[0].type).toBe('RECEIVED_PAGE');
            expect(actions[0].data.page).toEqual(mockUpdatedPage);
        });

        test('should return error without API call when page has no wiki_id', async () => {
            const pageId = 'translated_page_id';
            const mockPage = {id: pageId, type: 'page', props: {title: 'No Wiki'}};
            testStore.getState().entities.pages.byId = {[pageId]: mockPage as any};

            const result = await testStore.dispatch(
                Actions.setPageTranslationMetadata(pageId, 'source', 'es'),
            );

            expect(result.error).toBeTruthy();
            expect(Client4.patchPost).not.toHaveBeenCalled();
        });

        test('should handle error when setting translation metadata fails', async () => {
            const pageId = 'translated_page_id';
            const sourcePageId = 'source_page_id';
            const languageCode = 'es';
            const wikiId = 'wiki_id_1';
            const error = new Error('Failed to set metadata');

            testStore.getState().entities.pages.byId = {
                [pageId]: {id: pageId, type: 'page', props: {[PagePropsKeys.WIKI_ID]: wikiId}} as any,
            };
            (Client4.patchPost as jest.Mock).mockRejectedValue(error);

            const result = await testStore.dispatch(Actions.setPageTranslationMetadata(pageId, sourcePageId, languageCode));

            expect(result.error).toBeTruthy();
        });
    });

    describe('addPageTranslationReference', () => {
        const wikiId = 'wiki_id_1';

        test('should add translation reference to source page', async () => {
            const sourcePageId = 'source_page_id';
            const translatedPageId = 'translated_page_id';
            const languageCode = 'es';
            const mockSourcePage = {
                id: sourcePageId,
                type: 'page',
                props: {title: 'Source Page', [PagePropsKeys.WIKI_ID]: wikiId},
            };
            const expectedTranslations = [{page_id: translatedPageId, language_code: languageCode}];
            const mockUpdatedPage = {
                ...mockSourcePage,
                props: {
                    ...mockSourcePage.props,
                    [PagePropsKeys.TRANSLATIONS]: expectedTranslations,
                },
            };

            testStore.getState().entities.pages.byId = {[sourcePageId]: mockSourcePage as any};
            (Client4.patchPost as jest.Mock).mockResolvedValue(mockUpdatedPage);

            await testStore.dispatch(Actions.addPageTranslationReference(sourcePageId, translatedPageId, languageCode));

            expect(Client4.patchPost).toHaveBeenCalledWith({
                id: sourcePageId,
                props: {
                    title: 'Source Page',
                    [PagePropsKeys.WIKI_ID]: wikiId,
                    [PagePropsKeys.TRANSLATIONS]: expectedTranslations,
                },
            });

            const actions = testStore.getActions();
            expect(actions).toHaveLength(1);
            expect(actions[0].type).toBe('RECEIVED_PAGE');
        });

        test('should append to existing translations array', async () => {
            const sourcePageId = 'source_page_id';
            const translatedPageId = 'translated_page_id';
            const languageCode = 'fr';
            const existingTranslations = [{page_id: 'existing_page', language_code: 'es'}];
            const mockSourcePage = {
                id: sourcePageId,
                type: 'page',
                props: {
                    title: 'Source Page',
                    [PagePropsKeys.WIKI_ID]: wikiId,
                    [PagePropsKeys.TRANSLATIONS]: existingTranslations,
                },
            };
            const expectedTranslations = [
                ...existingTranslations,
                {page_id: translatedPageId, language_code: languageCode},
            ];
            const mockUpdatedPage = {
                ...mockSourcePage,
                props: {
                    ...mockSourcePage.props,
                    [PagePropsKeys.TRANSLATIONS]: expectedTranslations,
                },
            };

            testStore.getState().entities.pages.byId = {[sourcePageId]: mockSourcePage as any};
            (Client4.patchPost as jest.Mock).mockResolvedValue(mockUpdatedPage);

            await testStore.dispatch(Actions.addPageTranslationReference(sourcePageId, translatedPageId, languageCode));

            expect(Client4.patchPost).toHaveBeenCalledWith({
                id: sourcePageId,
                props: {
                    title: 'Source Page',
                    [PagePropsKeys.WIKI_ID]: wikiId,
                    [PagePropsKeys.TRANSLATIONS]: expectedTranslations,
                },
            });
        });

        test('should replace existing translation for same language', async () => {
            const sourcePageId = 'source_page_id';
            const translatedPageId = 'new_translated_page_id';
            const languageCode = 'es';
            const existingTranslations = [
                {page_id: 'old_spanish_page', language_code: 'es'},
                {page_id: 'french_page', language_code: 'fr'},
            ];
            const mockSourcePage = {
                id: sourcePageId,
                type: 'page',
                props: {
                    title: 'Source Page',
                    [PagePropsKeys.WIKI_ID]: wikiId,
                    [PagePropsKeys.TRANSLATIONS]: existingTranslations,
                },
            };
            const expectedTranslations = [
                {page_id: 'french_page', language_code: 'fr'},
                {page_id: translatedPageId, language_code: languageCode},
            ];
            const mockUpdatedPage = {
                ...mockSourcePage,
                props: {
                    ...mockSourcePage.props,
                    [PagePropsKeys.TRANSLATIONS]: expectedTranslations,
                },
            };

            testStore.getState().entities.pages.byId = {[sourcePageId]: mockSourcePage as any};
            (Client4.patchPost as jest.Mock).mockResolvedValue(mockUpdatedPage);

            await testStore.dispatch(Actions.addPageTranslationReference(sourcePageId, translatedPageId, languageCode));

            expect(Client4.patchPost).toHaveBeenCalledWith({
                id: sourcePageId,
                props: {
                    title: 'Source Page',
                    [PagePropsKeys.WIKI_ID]: wikiId,
                    [PagePropsKeys.TRANSLATIONS]: expectedTranslations,
                },
            });
        });

        test('should return error without API call when source page has no wiki_id', async () => {
            const sourcePageId = 'source_page_id';
            const mockSourcePage = {id: sourcePageId, type: 'page', props: {title: 'No Wiki'}};
            testStore.getState().entities.pages.byId = {[sourcePageId]: mockSourcePage as any};

            const result = await testStore.dispatch(
                Actions.addPageTranslationReference(sourcePageId, 'translated', 'es'),
            );

            expect(result.error).toBeTruthy();
            expect(Client4.patchPost).not.toHaveBeenCalled();
        });

        test('should handle error when adding translation reference fails', async () => {
            const sourcePageId = 'source_page_id';
            const translatedPageId = 'translated_page_id';
            const languageCode = 'es';
            const error = new Error('Failed to add reference');

            testStore.getState().entities.pages.byId = {
                [sourcePageId]: {id: sourcePageId, type: 'page', props: {[PagePropsKeys.WIKI_ID]: wikiId}} as any,
            };
            (Client4.patchPost as jest.Mock).mockRejectedValue(error);

            const result = await testStore.dispatch(Actions.addPageTranslationReference(sourcePageId, translatedPageId, languageCode));

            expect(result.error).toBeTruthy();
        });
    });
});

describe('actions/pages - Page Hierarchy', () => {
    let testStore: ReturnType<typeof mockStore>;

    beforeEach(() => {
        testStore = mockStore({
            entities: {
                pages: makeInitialPagesState(),
                posts: {
                    posts: {},
                },
                users: {
                    currentUserId: 'test_user_id',
                },
                general: {
                    config: {},
                },
                preferences: {
                    myPreferences: {},
                },
            },
            storage: {
                storage: {},
            },
        });
        jest.clearAllMocks();
    });

    describe('movePageInHierarchy', () => {
        test('should dispatch optimistic update and call API for parent change', async () => {
            const pageId = 'test_page_id';
            const wikiId = 'test_wiki_id';
            const newParentId = 'new_parent_id';
            const mockPage = {
                id: pageId,
                page_parent_id: '',
                props: {title: 'Test Page'},
                update_at: 1234567890,
            };

            testStore.getState().entities.pages.byId = {[pageId]: mockPage as any};
            (Client4.movePage as jest.Mock).mockResolvedValue({status: 'ok'});

            await testStore.dispatch(Actions.movePageInHierarchy(pageId, newParentId, wikiId));

            expect(Client4.movePage).toHaveBeenCalledWith(wikiId, pageId, newParentId, undefined);
        });

        test('should call API with newIndex for reordering', async () => {
            const pageId = 'test_page_id';
            const wikiId = 'test_wiki_id';
            const newIndex = 2;
            const mockPage = {
                id: pageId,
                page_parent_id: 'parent_id',
                props: {title: 'Test Page'},
                update_at: 1234567890,
            };

            testStore.getState().entities.pages.byId = {[pageId]: mockPage as any};
            (Client4.movePage as jest.Mock).mockResolvedValue({status: 'ok'});

            // null newParentId means keep current parent
            await testStore.dispatch(Actions.movePageInHierarchy(pageId, null, wikiId, newIndex));

            // When newParentId is null, API should be called with undefined (keep current)
            expect(Client4.movePage).toHaveBeenCalledWith(wikiId, pageId, undefined, newIndex);
        });

        test('should dispatch RECEIVED_POST for each sibling when server returns updated siblings', async () => {
            const pageId = 'page_to_move';
            const siblingId = 'sibling_page';
            const wikiId = 'test_wiki_id';
            const newIndex = 0;
            const mockPage = {
                id: pageId,
                page_parent_id: 'parent_id',
                props: {title: 'Moving Page', page_sort_order: 2000},
                update_at: 1234567890,
            };
            const mockSibling = {
                id: siblingId,
                page_parent_id: 'parent_id',
                props: {title: 'Sibling Page', page_sort_order: 1000},
                update_at: 1234567890,
            };

            testStore.getState().entities.pages.byId = {
                [pageId]: mockPage as any,
                [siblingId]: mockSibling as any,
            };

            // Server returns PostList with updated page_sort_order values
            const updatedPageFromServer = {
                ...mockPage,
                props: {title: 'Moving Page', page_sort_order: 1000}, // Now first
                update_at: 1234567891,
            };
            const updatedSiblingFromServer = {
                ...mockSibling,
                props: {title: 'Sibling Page', page_sort_order: 2000}, // Now second
                update_at: 1234567891,
            };
            const serverResponse = {
                order: [pageId, siblingId],
                posts: {
                    [pageId]: updatedPageFromServer,
                    [siblingId]: updatedSiblingFromServer,
                },
            };
            (Client4.movePage as jest.Mock).mockResolvedValue(serverResponse);

            await testStore.dispatch(Actions.movePageInHierarchy(pageId, null, wikiId, newIndex));

            const actions = testStore.getActions();

            // Find RECEIVED_PAGE actions for each sibling
            const receivedPageActions = actions.filter(
                (a: {type: string}) => a.type === 'RECEIVED_PAGE',
            );

            // Should have 2 RECEIVED_PAGE actions (one for each sibling) plus the optimistic update
            // The optimistic update is also RECEIVED_PAGE, so we have 3 total
            expect(receivedPageActions.length).toBeGreaterThanOrEqual(2);

            // Verify the server-returned posts are dispatched with correct page_sort_order
            const pageAction = receivedPageActions.find(
                (a: {data: {page: {id: string; props?: Record<string, number>}}}) => a.data.page.id === pageId && a.data.page.props?.page_sort_order === 1000,
            );
            const siblingAction = receivedPageActions.find(
                (a: {data: {page: {id: string; props?: Record<string, number>}}}) => a.data.page.id === siblingId && a.data.page.props?.page_sort_order === 2000,
            );

            expect(pageAction).toBeDefined();
            expect(siblingAction).toBeDefined();
        });

        test('should handle API error gracefully', async () => {
            const pageId = 'test_page_id';
            const wikiId = 'test_wiki_id';
            const newParentId = 'new_parent_id';
            const mockPage = {
                id: pageId,
                page_parent_id: '',
                props: {title: 'Test Page'},
                update_at: 1234567890,
            };
            const error = new Error('API error');

            testStore.getState().entities.pages.byId = {[pageId]: mockPage as any};
            (Client4.movePage as jest.Mock).mockRejectedValue(error);

            const result = await testStore.dispatch(Actions.movePageInHierarchy(pageId, newParentId, wikiId));

            expect(result.error).toBeTruthy();
        });

        test('should return error when page not found in store', async () => {
            const pageId = 'non_existent_page';
            const wikiId = 'test_wiki_id';
            const newParentId = 'new_parent_id';

            testStore.getState().entities.pages.byId = {};

            const result = await testStore.dispatch(Actions.movePageInHierarchy(pageId, newParentId, wikiId));

            expect(result.error).toBeTruthy();
            expect(Client4.movePage).not.toHaveBeenCalled();
        });
    });
});
