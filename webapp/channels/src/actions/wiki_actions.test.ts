// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import mockStore from 'tests/test_store';

import * as draftsActions from './page_drafts';
import * as pagesActions from './pages';
import {fetchWikiBundle, refetchWikiBundle} from './wiki_actions';

jest.mock('./pages');
jest.mock('./page_drafts');

const mockFetchPages = pagesActions.fetchPages as jest.MockedFunction<typeof pagesActions.fetchPages>;
const mockFetchDrafts = draftsActions.fetchPageDraftsForWiki as jest.MockedFunction<typeof draftsActions.fetchPageDraftsForWiki>;

describe('wiki_actions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFetchPages.mockReturnValue(() => Promise.resolve({data: []}));
        mockFetchDrafts.mockReturnValue(() => Promise.resolve({data: []}));
    });

    describe('fetchWikiBundle', () => {
        it('should fetch pages if cache is empty', async () => {
            const state = {
                entities: {
                    wikiPages: {
                        byWiki: {},
                    },
                    posts: {
                        posts: {},
                    },
                },
                storage: {
                    storage: {},
                },
            };

            const testStore = await mockStore(state);

            await testStore.dispatch(fetchWikiBundle('wiki1'));

            expect(mockFetchPages).toHaveBeenCalledWith('wiki1');
            expect(mockFetchDrafts).toHaveBeenCalledWith('wiki1');
        });

        it('should not fetch pages if cache is populated', async () => {
            const state = {
                entities: {
                    wikiPages: {
                        byWiki: {
                            wiki1: ['page1', 'page2'],
                        },
                    },
                    posts: {
                        posts: {
                            page1: {id: 'page1', message: 'Page 1'},
                            page2: {id: 'page2', message: 'Page 2'},
                        },
                    },
                },
                storage: {
                    storage: {},
                },
            };

            const testStore = await mockStore(state);

            await testStore.dispatch(fetchWikiBundle('wiki1'));

            expect(mockFetchPages).not.toHaveBeenCalled();
            expect(mockFetchDrafts).toHaveBeenCalledWith('wiki1');
        });

        it('should handle empty wiki (cache with empty array)', async () => {
            const state = {
                entities: {
                    wikiPages: {
                        byWiki: {
                            wiki1: [],
                        },
                    },
                    posts: {
                        posts: {},
                    },
                },
                storage: {
                    storage: {},
                },
            };

            const testStore = await mockStore(state);

            await testStore.dispatch(fetchWikiBundle('wiki1'));

            expect(mockFetchPages).not.toHaveBeenCalled();
            expect(mockFetchDrafts).toHaveBeenCalledWith('wiki1');
        });

        it('should always fetch drafts regardless of cache', async () => {
            const stateWithCache = {
                entities: {
                    wikiPages: {
                        byWiki: {
                            wiki1: ['page1'],
                        },
                    },
                    posts: {
                        posts: {
                            page1: {id: 'page1'},
                        },
                    },
                },
                storage: {
                    storage: {
                        'page_draft:wiki1_draft1': {value: {id: 'draft1'}},
                    },
                },
            };

            const testStore = await mockStore(stateWithCache);

            await testStore.dispatch(fetchWikiBundle('wiki1'));

            expect(mockFetchDrafts).toHaveBeenCalledWith('wiki1');
        });
    });

    describe('refetchWikiBundle', () => {
        it('should always fetch regardless of cache state', async () => {
            const stateWithFullCache = {
                entities: {
                    wikiPages: {
                        byWiki: {
                            wiki1: ['page1', 'page2'],
                        },
                    },
                    posts: {
                        posts: {
                            page1: {id: 'page1'},
                            page2: {id: 'page2'},
                        },
                    },
                },
                storage: {
                    storage: {
                        'page_draft:wiki1_draft1': {value: {id: 'draft1'}},
                    },
                },
            };

            const testStore = await mockStore(stateWithFullCache);

            await testStore.dispatch(refetchWikiBundle('wiki1'));

            expect(mockFetchPages).toHaveBeenCalledWith('wiki1');
            expect(mockFetchDrafts).toHaveBeenCalledWith('wiki1');
        });

        it('should fetch for empty cache as well', async () => {
            const stateWithEmptyCache = {
                entities: {
                    wikiPages: {
                        byWiki: {},
                    },
                    posts: {
                        posts: {},
                    },
                },
                storage: {
                    storage: {},
                },
            };

            const testStore = await mockStore(stateWithEmptyCache);

            await testStore.dispatch(refetchWikiBundle('wiki1'));

            expect(mockFetchPages).toHaveBeenCalledWith('wiki1');
            expect(mockFetchDrafts).toHaveBeenCalledWith('wiki1');
        });
    });
});
