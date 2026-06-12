// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Wiki} from '@mattermost/types/wikis';

import {UserTypes, WikiTypes} from 'mattermost-redux/action_types';

import wikisReducer from './wikis';

describe('wikis reducer', () => {
    const initialState = {
        byId: {},
        byTeam: {},
        linksByChannel: {},
    };

    const channelId = 'channel123';
    const wikiId = 'wiki123';

    const mockWiki: Wiki = {
        id: wikiId,
        team_id: 'team123',
        creator_id: 'user123',
        title: 'Test Wiki',
        description: 'Test description',
        icon: 'book',
        create_at: 1234567890,
        update_at: 1234567890,
        delete_at: 0,
        sort_order: 0,
    };

    describe('RECEIVED_WIKI', () => {
        test('should add a new wiki to state', () => {
            const result = wikisReducer(initialState, {
                type: WikiTypes.RECEIVED_WIKI,
                data: mockWiki,
            });

            expect(result.byId[wikiId]).toEqual(mockWiki);
        });

        test('should update an existing wiki', () => {
            const stateWithWiki = {
                byId: {[wikiId]: mockWiki},
                byTeam: {},
                linksByChannel: {},
            };

            const updatedWiki: Wiki = {
                ...mockWiki,
                title: 'Updated Wiki Title',
                update_at: 1234567999,
            };

            const result = wikisReducer(stateWithWiki, {
                type: WikiTypes.RECEIVED_WIKI,
                data: updatedWiki,
            });

            expect(result.byId[wikiId].title).toBe('Updated Wiki Title');
            expect(result.byId[wikiId].update_at).toBe(1234567999);
        });

        test('should merge partial wiki update with existing wiki data', () => {
            const stateWithWiki = {
                byId: {[wikiId]: mockWiki},
                byTeam: {},
                linksByChannel: {},
            };

            // Partial update (like from websocket event) - only includes updated fields
            const partialUpdate = {
                id: wikiId,
                channel_id: channelId,
                title: 'Renamed Wiki',
                description: 'New description',
                update_at: 1234567999,
            };

            const result = wikisReducer(stateWithWiki, {
                type: WikiTypes.RECEIVED_WIKI,
                data: partialUpdate,
            });

            expect(result.byId[wikiId].title).toBe('Renamed Wiki');
            expect(result.byId[wikiId].description).toBe('New description');
            expect(result.byId[wikiId].update_at).toBe(1234567999);

            // Fields not in partial update should be preserved from existing wiki
            expect(result.byId[wikiId].icon).toBe('book');
            expect(result.byId[wikiId].create_at).toBe(1234567890);
            expect(result.byId[wikiId].delete_at).toBe(0);
        });
    });

    describe('RECEIVED_WIKIS', () => {
        test('should add multiple wikis to state', () => {
            const wiki2: Wiki = {
                ...mockWiki,
                id: 'wiki456',
                title: 'Second Wiki',
            };

            const result = wikisReducer(initialState, {
                type: WikiTypes.RECEIVED_WIKIS,
                data: [mockWiki, wiki2],
            });

            expect(result.byId[wikiId]).toEqual(mockWiki);
            expect(result.byId.wiki456).toEqual(wiki2);
        });

        test('should return same state for empty array', () => {
            const result = wikisReducer(initialState, {
                type: WikiTypes.RECEIVED_WIKIS,
                data: [],
            });
            expect(result).toBe(initialState);
        });

        test('should return same state for null/undefined data', () => {
            const result = wikisReducer(initialState, {
                type: WikiTypes.RECEIVED_WIKIS,
                data: null,
            });
            expect(result).toBe(initialState);
        });

        test('should merge partial wiki updates with existing data', () => {
            const stateWithWiki = {
                byId: {[wikiId]: mockWiki},
                byTeam: {},
                linksByChannel: {},
            };

            const partialUpdate = {
                id: wikiId,
                channel_id: channelId,
                title: 'Renamed Wiki',
                update_at: 1234567999,
            };

            const result = wikisReducer(stateWithWiki, {
                type: WikiTypes.RECEIVED_WIKIS,
                data: [partialUpdate],
            });

            expect(result.byId[wikiId].title).toBe('Renamed Wiki');
            expect(result.byId[wikiId].update_at).toBe(1234567999);
            expect(result.byId[wikiId].icon).toBe('book');
            expect(result.byId[wikiId].create_at).toBe(1234567890);
            expect(result.byId[wikiId].description).toBe('Test description');
        });
    });

    describe('DELETED_WIKI', () => {
        test('should remove wiki from state', () => {
            const stateWithWiki = {
                byId: {[wikiId]: mockWiki},
                byTeam: {},
                linksByChannel: {},
            };

            const result = wikisReducer(stateWithWiki, {
                type: WikiTypes.DELETED_WIKI,
                data: {wikiId},
            });

            expect(result.byId[wikiId]).toBeUndefined();
        });

        test('should return same state if wiki does not exist', () => {
            const result = wikisReducer(initialState, {
                type: WikiTypes.DELETED_WIKI,
                data: {wikiId: 'nonexistent'},
            });

            expect(result).toBe(initialState);
        });

        test('should remove links pointing to the deleted wiki', () => {
            const stateWithLink = {
                byId: {[wikiId]: mockWiki},
                byTeam: {},
                linksByChannel: {
                    sourceChannel1: [{source_id: 'sourceChannel1', wiki_id: wikiId, create_at: 0}],
                },
            };

            const result = wikisReducer(stateWithLink, {
                type: WikiTypes.DELETED_WIKI,
                data: {wikiId},
            });

            expect(result.linksByChannel.sourceChannel1).toEqual([]);
        });
    });

    describe('RECEIVED_WIKI_LINK / REMOVED_WIKI_LINK', () => {
        test('adds a link to linksByChannel', () => {
            const link = {source_id: 'ch1', wiki_id: wikiId, create_at: 0};
            const result = wikisReducer(initialState, {
                type: WikiTypes.RECEIVED_WIKI_LINK,
                data: {channelId: 'ch1', link, wikiId},
            });
            expect(result.linksByChannel.ch1).toEqual([link]);
        });

        test('does not duplicate an existing link', () => {
            const link = {source_id: 'ch1', wiki_id: wikiId, create_at: 0};
            const stateWithLink = {
                byId: {},
                byTeam: {},
                linksByChannel: {ch1: [link]},
            };
            const result = wikisReducer(stateWithLink, {
                type: WikiTypes.RECEIVED_WIKI_LINK,
                data: {channelId: 'ch1', link, wikiId},
            });
            expect(result).toBe(stateWithLink);
        });

        test('removes a link from linksByChannel', () => {
            const link = {source_id: 'ch1', wiki_id: wikiId, create_at: 0};
            const stateWithLink = {
                byId: {},
                byTeam: {},
                linksByChannel: {ch1: [link]},
            };
            const result = wikisReducer(stateWithLink, {
                type: WikiTypes.REMOVED_WIKI_LINK,
                data: {channelId: 'ch1', wikiId},
            });
            expect(result.linksByChannel.ch1).toEqual([]);
        });
    });

    describe('LOGOUT_SUCCESS', () => {
        test('should reset state to initial state', () => {
            const stateWithWiki = {
                byId: {[wikiId]: mockWiki},
                byTeam: {},
                linksByChannel: {},
            };

            const result = wikisReducer(stateWithWiki, {type: UserTypes.LOGOUT_SUCCESS});

            expect(result).toEqual(initialState);
        });
    });

    describe('unknown action', () => {
        test('should return current state for unknown actions', () => {
            const stateWithWiki = {
                byId: {[wikiId]: mockWiki},
                byTeam: {},
                linksByChannel: {},
            };

            const result = wikisReducer(stateWithWiki, {type: 'UNKNOWN_ACTION'});

            expect(result).toBe(stateWithWiki);
        });
    });
});
