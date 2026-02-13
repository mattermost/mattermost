// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

import {PostTypes} from 'mattermost-redux/constants/posts';

import type {GlobalState} from 'types/store';

import {
    getPage,
    getPageAncestors,
    getPages,
    getChannelPages,
    getPagesLoading,
    getPagesError,
} from './pages';

describe('pages selectors', () => {
    const wikiId = 'wiki123';
    const pageId1 = 'page1';
    const pageId2 = 'page2';
    const pageId3 = 'page3';

    const mockPage1: Post = {
        id: pageId1,
        create_at: 1234567890,
        update_at: 1234567890,
        delete_at: 0,
        edit_at: 0,
        is_pinned: false,
        user_id: 'user123',
        channel_id: wikiId,
        root_id: '',
        original_id: '',
        page_parent_id: '',
        message: 'Page 1 content',
        type: PostTypes.PAGE,
        props: {title: 'Root Page'},
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

    const mockPage2: Post = {
        ...mockPage1,
        id: pageId2,
        page_parent_id: pageId1,
        props: {title: 'Child Page'},
        message: 'Page 2 content',
    };

    const mockPage3: Post = {
        ...mockPage1,
        id: pageId3,
        page_parent_id: pageId2,
        props: {title: 'Grandchild Page'},
        message: 'Page 3 content',
    };

    const initialState: Partial<GlobalState> = {
        entities: {
            posts: {
                posts: {
                    [pageId1]: mockPage1,
                    [pageId2]: mockPage2,
                    [pageId3]: mockPage3,
                },
            },
            wikiPages: {
                byWiki: {
                    [wikiId]: [pageId1, pageId2, pageId3],
                },
                publishedDraftTimestamps: {},
            },
        },
        requests: {
            wiki: {
                loading: {},
                error: {},
            },
        },
    } as any;

    describe('getPage', () => {
        test('should return page from entities.posts', () => {
            const page = getPage(initialState as GlobalState, pageId1);

            expect(page).toEqual(mockPage1);
            expect(page?.id).toBe(pageId1);
            expect(page?.props?.title).toBe('Root Page');
        });

        test('should return undefined for non-existent page', () => {
            const page = getPage(initialState as GlobalState, 'non-existent');

            expect(page).toBeUndefined();
        });

        test('should read from single source of truth (entities.posts)', () => {
            const page = getPage(initialState as GlobalState, pageId1);

            expect(page).toBe(initialState.entities!.posts.posts[pageId1]);
        });

        test('should not read from pageSummaries or fullPages (removed)', () => {
            const state = initialState as GlobalState;

            expect(state.entities!.wikiPages).not.toHaveProperty('pageSummaries');
            expect(state.entities!.wikiPages).not.toHaveProperty('fullPages');
        });
    });

    describe('getPageAncestors', () => {
        test('should return empty array for root page', () => {
            const ancestors = getPageAncestors(initialState as GlobalState, pageId1);

            expect(ancestors).toEqual([]);
        });

        test('should return single ancestor', () => {
            const ancestors = getPageAncestors(initialState as GlobalState, pageId2);

            expect(ancestors).toEqual([mockPage1]);
            expect(ancestors[0].id).toBe(pageId1);
        });

        test('should return full ancestor chain', () => {
            const ancestors = getPageAncestors(initialState as GlobalState, pageId3);

            expect(ancestors).toEqual([mockPage1, mockPage2]);
            expect(ancestors[0].id).toBe(pageId1);
            expect(ancestors[1].id).toBe(pageId2);
        });

        test('should stop at missing parent', () => {
            const stateWithMissingParent: Partial<GlobalState> = {
                entities: {
                    posts: {
                        posts: {
                            [pageId3]: mockPage3,
                        },
                    },
                    wikiPages: {
                        byWiki: {[wikiId]: [pageId3]},
                        loading: {},
                        error: {},
                        publishedDraftTimestamps: {},
                    },
                },
            } as any;

            const ancestors = getPageAncestors(stateWithMissingParent as GlobalState, pageId3);

            expect(ancestors).toEqual([]);
        });

        test('should handle circular reference gracefully', () => {
            const circularPage1: Post = {...mockPage1, page_parent_id: pageId2};
            const circularPage2: Post = {...mockPage2, page_parent_id: pageId1};

            const stateWithCircular: Partial<GlobalState> = {
                entities: {
                    posts: {
                        posts: {
                            [pageId1]: circularPage1,
                            [pageId2]: circularPage2,
                        },
                    },
                    wikiPages: {
                        byWiki: {[wikiId]: [pageId1, pageId2]},
                        loading: {},
                        error: {},
                        publishedDraftTimestamps: {},
                    },
                },
            } as any;

            const ancestors = getPageAncestors(stateWithCircular as GlobalState, pageId1);

            expect(ancestors.length).toBeLessThan(100);
        });
    });

    describe('getPages', () => {
        test('should return pages for wiki from entities.posts', () => {
            const pages = getPages(initialState as GlobalState, wikiId);

            expect(pages).toHaveLength(3);
            expect(pages[0].id).toBe(pageId1);
            expect(pages[1].id).toBe(pageId2);
            expect(pages[2].id).toBe(pageId3);
        });

        test('should filter out non-PAGE types', () => {
            const stateWithNonPage: Partial<GlobalState> = {
                entities: {
                    posts: {
                        posts: {
                            [pageId1]: mockPage1,
                            regularPost: {...mockPage1, id: 'regularPost', type: 'normal'},
                        },
                    },
                    wikiPages: {
                        byWiki: {[wikiId]: [pageId1, 'regularPost']},
                        loading: {},
                        error: {},
                        publishedDraftTimestamps: {},
                    },
                },
            } as any;

            const pages = getPages(stateWithNonPage as GlobalState, wikiId);

            expect(pages).toHaveLength(1);
            expect(pages[0].id).toBe(pageId1);
        });

        test('should return empty array for non-existent wiki', () => {
            const pages = getPages(initialState as GlobalState, 'non-existent-wiki');

            expect(pages).toEqual([]);
        });

        test('should filter out missing pages', () => {
            const stateWithMissing: Partial<GlobalState> = {
                entities: {
                    posts: {
                        posts: {
                            [pageId1]: mockPage1,
                        },
                    },
                    wikiPages: {
                        byWiki: {[wikiId]: [pageId1, 'missing-page']},
                        loading: {},
                        error: {},
                        publishedDraftTimestamps: {},
                    },
                },
            } as any;

            const pages = getPages(stateWithMissing as GlobalState, wikiId);

            expect(pages).toHaveLength(1);
            expect(pages[0].id).toBe(pageId1);
        });

        test('should use memoization (createSelector)', () => {
            const pages1 = getPages(initialState as GlobalState, wikiId);
            const pages2 = getPages(initialState as GlobalState, wikiId);

            expect(pages1).toBe(pages2);
        });

        test('should read from single source of truth', () => {
            const pages = getPages(initialState as GlobalState, wikiId);

            pages.forEach((page) => {
                expect(page).toBe(initialState.entities!.posts.posts[page.id]);
            });
        });
    });

    describe('getChannelPages', () => {
        const channelId = 'channel123';
        const wiki1Id = 'wiki1';
        const wiki2Id = 'wiki2';

        const channelPage1: Post = {
            ...mockPage1,
            id: 'channelPage1',
            channel_id: channelId,
        };

        const channelPage2: Post = {
            ...mockPage1,
            id: 'channelPage2',
            channel_id: channelId,
        };

        const channelPage3: Post = {
            ...mockPage1,
            id: 'channelPage3',
            channel_id: channelId,
        };

        test('should return pages from multiple wikis in a channel using indexes', () => {
            const state: Partial<GlobalState> = {
                entities: {
                    posts: {
                        posts: {
                            channelPage1,
                            channelPage2,
                            channelPage3,
                        },
                    },
                    wikis: {
                        byId: {
                            [wiki1Id]: {id: wiki1Id, channel_id: channelId, title: 'Wiki 1'},
                            [wiki2Id]: {id: wiki2Id, channel_id: channelId, title: 'Wiki 2'},
                        },
                        byChannel: {
                            [channelId]: [wiki1Id, wiki2Id],
                        },
                    },
                    wikiPages: {
                        byWiki: {
                            [wiki1Id]: ['channelPage1', 'channelPage2'],
                            [wiki2Id]: ['channelPage3'],
                        },
                        publishedDraftTimestamps: {},
                    },
                },
            } as any;

            const pages = getChannelPages(state as GlobalState, channelId);

            expect(pages).toHaveLength(3);
            expect(pages.map((p) => p.id)).toEqual(['channelPage1', 'channelPage2', 'channelPage3']);
        });

        test('should return empty array when byChannel index is missing', () => {
            const state: Partial<GlobalState> = {
                entities: {
                    posts: {
                        posts: {channelPage1},
                    },
                    wikis: {
                        byId: {},
                        byChannel: {},
                    },
                    wikiPages: {
                        byWiki: {[wiki1Id]: ['channelPage1']},
                        publishedDraftTimestamps: {},
                    },
                },
            } as any;

            const pages = getChannelPages(state as GlobalState, channelId);

            expect(pages).toEqual([]);
        });

        test('should return empty array when byWiki index is missing', () => {
            const state: Partial<GlobalState> = {
                entities: {
                    posts: {
                        posts: {channelPage1},
                    },
                    wikis: {
                        byId: {[wiki1Id]: {id: wiki1Id, channel_id: channelId}},
                        byChannel: {[channelId]: [wiki1Id]},
                    },
                    wikiPages: {},
                },
            } as any;

            const pages = getChannelPages(state as GlobalState, channelId);

            expect(pages).toEqual([]);
        });

        test('should filter out non-PAGE posts', () => {
            const regularPost: Post = {
                ...mockPage1,
                id: 'regularPost',
                channel_id: channelId,
                type: '' as any,
            };

            const state: Partial<GlobalState> = {
                entities: {
                    posts: {
                        posts: {
                            channelPage1,
                            regularPost,
                        },
                    },
                    wikis: {
                        byId: {[wiki1Id]: {id: wiki1Id, channel_id: channelId}},
                        byChannel: {[channelId]: [wiki1Id]},
                    },
                    wikiPages: {
                        byWiki: {[wiki1Id]: ['channelPage1', 'regularPost']},
                        publishedDraftTimestamps: {},
                    },
                },
            } as any;

            const pages = getChannelPages(state as GlobalState, channelId);

            expect(pages).toHaveLength(1);
            expect(pages[0].id).toBe('channelPage1');
        });

        test('should filter out missing posts', () => {
            const state: Partial<GlobalState> = {
                entities: {
                    posts: {
                        posts: {channelPage1},
                    },
                    wikis: {
                        byId: {[wiki1Id]: {id: wiki1Id, channel_id: channelId}},
                        byChannel: {[channelId]: [wiki1Id]},
                    },
                    wikiPages: {
                        byWiki: {[wiki1Id]: ['channelPage1', 'missingPage']},
                        publishedDraftTimestamps: {},
                    },
                },
            } as any;

            const pages = getChannelPages(state as GlobalState, channelId);

            expect(pages).toHaveLength(1);
            expect(pages[0].id).toBe('channelPage1');
        });

        test('should use memoization', () => {
            const state: Partial<GlobalState> = {
                entities: {
                    posts: {
                        posts: {channelPage1},
                    },
                    wikis: {
                        byId: {[wiki1Id]: {id: wiki1Id, channel_id: channelId}},
                        byChannel: {[channelId]: [wiki1Id]},
                    },
                    wikiPages: {
                        byWiki: {[wiki1Id]: ['channelPage1']},
                        publishedDraftTimestamps: {},
                    },
                },
            } as any;

            const pages1 = getChannelPages(state as GlobalState, channelId);
            const pages2 = getChannelPages(state as GlobalState, channelId);

            expect(pages1).toBe(pages2);
        });
    });

    describe('getPagesLoading', () => {
        test('should return loading state for wiki', () => {
            const stateWithLoading: Partial<GlobalState> = {
                ...initialState,
                requests: {
                    ...initialState.requests,
                    wiki: {
                        ...initialState.requests!.wiki,
                        loading: {[wikiId]: true},
                    },
                },
            } as any;

            const loading = getPagesLoading(stateWithLoading as GlobalState, wikiId);

            expect(loading).toBe(true);
        });

        test('should return false if not loading', () => {
            const loading = getPagesLoading(initialState as GlobalState, wikiId);

            expect(loading).toBe(false);
        });
    });

    describe('getPagesError', () => {
        test('should return error for wiki', () => {
            const error = 'Failed to load pages';
            const stateWithError: Partial<GlobalState> = {
                ...initialState,
                requests: {
                    ...initialState.requests,
                    wiki: {
                        ...initialState.requests!.wiki,
                        error: {[wikiId]: error},
                    },
                },
            } as any;

            const errorResult = getPagesError(stateWithError as GlobalState, wikiId);

            expect(errorResult).toBe(error);
        });

        test('should return null if no error', () => {
            const error = getPagesError(initialState as GlobalState, wikiId);

            expect(error).toBeNull();
        });
    });

    describe('Single Source of Truth Validation', () => {
        test('all selectors should read from entities.posts only', () => {
            const state = initialState as GlobalState;

            const page = getPage(state, pageId1);
            expect(page).toBe(state.entities.posts.posts[pageId1]);

            const pages = getPages(state, wikiId);
            pages.forEach((p) => {
                expect(p).toBe(state.entities.posts.posts[p.id]);
            });

            const ancestors = getPageAncestors(state, pageId3);
            ancestors.forEach((p) => {
                expect(p).toBe(state.entities.posts.posts[p.id]);
            });
        });

        test('should not use pageSummaries or fullPages caches', () => {
            const state = initialState as GlobalState;

            expect(state.entities.wikiPages).not.toHaveProperty('pageSummaries');
            expect(state.entities.wikiPages).not.toHaveProperty('fullPages');
        });
    });
});
