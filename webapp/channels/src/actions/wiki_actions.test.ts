// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {WikiLink} from '@mattermost/types/wikis';

import {WikiTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';

import mockStore from 'tests/test_store';

import * as draftsActions from './page_drafts';
import * as pagesActions from './pages';
import {fetchWikiBundle, fetchWikiLinksForChannel, linkWikiToChannel, unlinkWikiFromChannel} from './wiki_actions';

jest.mock('./pages');
jest.mock('./page_drafts');
jest.mock('mattermost-redux/client');

const mockFetchWiki = pagesActions.fetchWiki as jest.MockedFunction<typeof pagesActions.fetchWiki>;
const mockFetchPages = pagesActions.fetchPages as jest.MockedFunction<typeof pagesActions.fetchPages>;
const mockFetchDrafts = draftsActions.fetchPageDraftsForWiki as jest.MockedFunction<typeof draftsActions.fetchPageDraftsForWiki>;

describe('wiki_actions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFetchWiki.mockReturnValue(() => Promise.resolve({data: {} as any}));
        mockFetchPages.mockReturnValue(() => Promise.resolve({data: []}));
        mockFetchDrafts.mockReturnValue(() => Promise.resolve({data: []}));

        // fetchWikiBundle now also fetches wiki links; without this default the
        // unmocked Client4 call returns undefined and the catch path tries to
        // read users.currentUserId from a state that doesn't include it.
        (Client4.getWikiLinks as jest.Mock).mockResolvedValue([]);
    });

    describe('fetchWikiBundle', () => {
        it('should fetch pages if cache is empty', async () => {
            const state = {
                entities: {
                    pages: {
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

        it('should always fetch pages even if cache is populated', async () => {
            const state = {
                entities: {
                    pages: {
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

            // Always fetch pages - WebSocket events can create partial cache entries
            expect(mockFetchPages).toHaveBeenCalledWith('wiki1');
            expect(mockFetchDrafts).toHaveBeenCalledWith('wiki1');
        });

        it('should always fetch pages even for empty wiki cache', async () => {
            const state = {
                entities: {
                    pages: {
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

            // Always fetch pages - cache might be from WebSocket partial update
            expect(mockFetchPages).toHaveBeenCalledWith('wiki1');
            expect(mockFetchDrafts).toHaveBeenCalledWith('wiki1');
        });

        it('should always fetch drafts regardless of cache', async () => {
            const stateWithCache = {
                entities: {
                    pages: {
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
});

describe('wiki link actions', () => {
    let testStore: ReturnType<typeof mockStore>;

    beforeEach(() => {
        testStore = mockStore({
            entities: {
                users: {
                    currentUserId: 'test_user_id',
                },
                wikis: {
                    byId: {
                        wiki_id_1: {id: 'wiki_id_1'},
                    },
                },
            },
        });
        jest.clearAllMocks();
    });

    describe('fetchWikiLinksForChannel', () => {
        test('should dispatch RECEIVED_WIKI_LINKS with correct payload on success', async () => {
            const channelId = 'channel_id_1';
            const mockLinks: WikiLink[] = [
                {source_id: channelId, wiki_id: 'wiki_1', create_at: 1000},
                {source_id: channelId, wiki_id: 'wiki_2', create_at: 2000},
            ];

            (Client4.getWikiLinksForChannel as jest.Mock).mockResolvedValue(mockLinks);

            const result = await testStore.dispatch(fetchWikiLinksForChannel(channelId));

            expect(Client4.getWikiLinksForChannel).toHaveBeenCalledWith(channelId);

            const actions = testStore.getActions();
            expect(actions).toHaveLength(1);
            expect(actions[0]).toEqual({
                type: WikiTypes.RECEIVED_WIKI_LINKS,
                data: {channelId, links: mockLinks},
            });

            expect(result.data).toEqual(mockLinks);
        });

        test('should return error when API call fails', async () => {
            const channelId = 'channel_id_1';
            const error = new Error('Failed to fetch wiki links');

            (Client4.getWikiLinksForChannel as jest.Mock).mockRejectedValue(error);

            const result = await testStore.dispatch(fetchWikiLinksForChannel(channelId));

            expect(result.error).toBeTruthy();
        });
    });

    describe('linkWikiToChannel', () => {
        test('should dispatch RECEIVED_WIKI_LINK with correct payload on success', async () => {
            const channelId = 'channel_id_1';
            const wikiId = 'wiki_id_1';
            const mockLink: WikiLink = {
                source_id: channelId,
                wiki_id: wikiId,
                create_at: 1000,
            };

            (Client4.linkWikiToChannel as jest.Mock).mockResolvedValue(mockLink);

            const result = await testStore.dispatch(linkWikiToChannel(channelId, wikiId));

            expect(Client4.linkWikiToChannel).toHaveBeenCalledWith(channelId, wikiId);

            const actions = testStore.getActions();
            expect(actions).toHaveLength(1);
            expect(actions[0]).toEqual({
                type: WikiTypes.RECEIVED_WIKI_LINK,
                data: {channelId, link: mockLink, wikiId},
            });

            expect(result.data).toEqual(mockLink);
        });

        test('should return error when API call fails', async () => {
            const channelId = 'channel_id_1';
            const wikiId = 'wiki_id_1';
            const error = new Error('Failed to link wiki');

            (Client4.linkWikiToChannel as jest.Mock).mockRejectedValue(error);

            const result = await testStore.dispatch(linkWikiToChannel(channelId, wikiId));

            expect(result.error).toBeTruthy();
        });
    });

    describe('unlinkWikiFromChannel', () => {
        test('should dispatch REMOVED_WIKI_LINK with correct channelId and wikiId on success', async () => {
            const channelId = 'channel_id_1';
            const wikiId = 'wiki_id_1';

            (Client4.unlinkWikiFromChannel as jest.Mock).mockResolvedValue({status: 'OK'});

            const result = await testStore.dispatch(unlinkWikiFromChannel(channelId, wikiId));

            expect(Client4.unlinkWikiFromChannel).toHaveBeenCalledWith(channelId, wikiId);

            const actions = testStore.getActions();
            expect(actions).toHaveLength(1);
            expect(actions[0]).toEqual({
                type: WikiTypes.REMOVED_WIKI_LINK,
                data: {channelId, wikiId},
            });

            expect(result.data).toBe(true);
        });

        test('should return error when API call fails', async () => {
            const channelId = 'channel_id_1';
            const wikiId = 'wiki_id_1';
            const error = new Error('Failed to unlink wiki');

            (Client4.unlinkWikiFromChannel as jest.Mock).mockRejectedValue(error);

            const result = await testStore.dispatch(unlinkWikiFromChannel(channelId, wikiId));

            expect(result.error).toBeTruthy();
        });
    });
});
