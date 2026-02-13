// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Wiki} from '@mattermost/types/wikis';

import {UserTypes, WikiTypes} from 'mattermost-redux/action_types';

import wikisReducer from './wikis';

describe('wikis reducer', () => {
    const initialState = {
        byChannel: {},
        byId: {},
    };

    const channelId = 'channel123';
    const wikiId = 'wiki123';

    const mockWiki: Wiki = {
        id: wikiId,
        channel_id: channelId,
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
            const action = {
                type: WikiTypes.RECEIVED_WIKI,
                data: mockWiki,
            };

            const result = wikisReducer(initialState, action);

            expect(result.byId[wikiId]).toEqual(mockWiki);
            expect(result.byChannel[channelId]).toEqual([wikiId]);
        });

        test('should update an existing wiki', () => {
            const stateWithWiki = {
                byChannel: {[channelId]: [wikiId]},
                byId: {[wikiId]: mockWiki},
            };

            const updatedWiki: Wiki = {
                ...mockWiki,
                title: 'Updated Wiki Title',
                update_at: 1234567999,
            };

            const action = {
                type: WikiTypes.RECEIVED_WIKI,
                data: updatedWiki,
            };

            const result = wikisReducer(stateWithWiki, action);

            expect(result.byId[wikiId].title).toBe('Updated Wiki Title');
            expect(result.byId[wikiId].update_at).toBe(1234567999);
            expect(result.byChannel[channelId]).toEqual([wikiId]);
        });

        test('should merge partial wiki update with existing wiki data', () => {
            const stateWithWiki = {
                byChannel: {[channelId]: [wikiId]},
                byId: {[wikiId]: mockWiki},
            };

            // Partial update (like from websocket event) - only includes updated fields
            const partialUpdate = {
                id: wikiId,
                channel_id: channelId,
                title: 'Renamed Wiki',
                description: 'New description',
                update_at: 1234567999,
            };

            const action = {
                type: WikiTypes.RECEIVED_WIKI,
                data: partialUpdate,
            };

            const result = wikisReducer(stateWithWiki, action);

            // Updated fields should be changed
            expect(result.byId[wikiId].title).toBe('Renamed Wiki');
            expect(result.byId[wikiId].description).toBe('New description');
            expect(result.byId[wikiId].update_at).toBe(1234567999);

            // Fields not in partial update should be preserved from existing wiki
            expect(result.byId[wikiId].icon).toBe('book');
            expect(result.byId[wikiId].create_at).toBe(1234567890);
            expect(result.byId[wikiId].delete_at).toBe(0);
        });

        test('should not duplicate wiki id in byChannel when wiki already exists', () => {
            const stateWithWiki = {
                byChannel: {[channelId]: [wikiId]},
                byId: {[wikiId]: mockWiki},
            };

            const updatedWiki: Wiki = {
                ...mockWiki,
                title: 'Updated Wiki Title',
            };

            const action = {
                type: WikiTypes.RECEIVED_WIKI,
                data: updatedWiki,
            };

            const result = wikisReducer(stateWithWiki, action);

            expect(result.byChannel[channelId]).toEqual([wikiId]);
            expect(result.byChannel[channelId].length).toBe(1);
        });

        test('should handle wiki moving to a different channel', () => {
            const newChannelId = 'channel456';
            const stateWithWiki = {
                byChannel: {[channelId]: [wikiId]},
                byId: {[wikiId]: mockWiki},
            };

            const movedWiki: Wiki = {
                ...mockWiki,
                channel_id: newChannelId,
            };

            const action = {
                type: WikiTypes.RECEIVED_WIKI,
                data: movedWiki,
            };

            const result = wikisReducer(stateWithWiki, action);

            expect(result.byChannel[channelId]).toEqual([]);
            expect(result.byChannel[newChannelId]).toEqual([wikiId]);
            expect(result.byId[wikiId].channel_id).toBe(newChannelId);
        });
    });

    describe('RECEIVED_WIKIS', () => {
        test('should add multiple wikis to state', () => {
            const wiki2: Wiki = {
                ...mockWiki,
                id: 'wiki456',
                title: 'Second Wiki',
            };

            const action = {
                type: WikiTypes.RECEIVED_WIKIS,
                data: [mockWiki, wiki2],
            };

            const result = wikisReducer(initialState, action);

            expect(result.byId[wikiId]).toEqual(mockWiki);
            expect(result.byId.wiki456).toEqual(wiki2);
            expect(result.byChannel[channelId]).toContain(wikiId);
            expect(result.byChannel[channelId]).toContain('wiki456');
        });

        test('should return same state for empty array', () => {
            const action = {
                type: WikiTypes.RECEIVED_WIKIS,
                data: [],
            };

            const result = wikisReducer(initialState, action);

            expect(result).toBe(initialState);
        });

        test('should return same state for null/undefined data', () => {
            const action = {
                type: WikiTypes.RECEIVED_WIKIS,
                data: null,
            };

            const result = wikisReducer(initialState, action);

            expect(result).toBe(initialState);
        });

        test('should merge partial wiki updates with existing data', () => {
            const stateWithWiki = {
                byChannel: {[channelId]: [wikiId]},
                byId: {[wikiId]: mockWiki},
            };

            const partialUpdate = {
                id: wikiId,
                channel_id: channelId,
                title: 'Renamed Wiki',
                update_at: 1234567999,
            };

            const action = {
                type: WikiTypes.RECEIVED_WIKIS,
                data: [partialUpdate],
            };

            const result = wikisReducer(stateWithWiki, action);

            // Updated fields should be changed
            expect(result.byId[wikiId].title).toBe('Renamed Wiki');
            expect(result.byId[wikiId].update_at).toBe(1234567999);

            // Fields not in partial update should be preserved
            expect(result.byId[wikiId].icon).toBe('book');
            expect(result.byId[wikiId].create_at).toBe(1234567890);
            expect(result.byId[wikiId].description).toBe('Test description');
        });

        test('should handle wikis from multiple channels', () => {
            const channel2Id = 'channel456';
            const wiki2: Wiki = {
                ...mockWiki,
                id: 'wiki456',
                channel_id: channel2Id,
                title: 'Wiki in Channel 2',
            };

            const action = {
                type: WikiTypes.RECEIVED_WIKIS,
                data: [mockWiki, wiki2],
            };

            const result = wikisReducer(initialState, action);

            expect(result.byChannel[channelId]).toEqual([wikiId]);
            expect(result.byChannel[channel2Id]).toEqual(['wiki456']);
        });
    });

    describe('DELETED_WIKI', () => {
        test('should remove wiki from state', () => {
            const stateWithWiki = {
                byChannel: {[channelId]: [wikiId]},
                byId: {[wikiId]: mockWiki},
            };

            const action = {
                type: WikiTypes.DELETED_WIKI,
                data: {wikiId},
            };

            const result = wikisReducer(stateWithWiki, action);

            expect(result.byId[wikiId]).toBeUndefined();
            expect(result.byChannel[channelId]).toEqual([]);
        });

        test('should return same state if wiki does not exist', () => {
            const action = {
                type: WikiTypes.DELETED_WIKI,
                data: {wikiId: 'nonexistent'},
            };

            const result = wikisReducer(initialState, action);

            expect(result).toBe(initialState);
        });

        test('should only remove the specified wiki from channel', () => {
            const wiki2Id = 'wiki456';
            const wiki2: Wiki = {
                ...mockWiki,
                id: wiki2Id,
                title: 'Second Wiki',
            };

            const stateWithWikis = {
                byChannel: {[channelId]: [wikiId, wiki2Id]},
                byId: {
                    [wikiId]: mockWiki,
                    [wiki2Id]: wiki2,
                },
            };

            const action = {
                type: WikiTypes.DELETED_WIKI,
                data: {wikiId},
            };

            const result = wikisReducer(stateWithWikis, action);

            expect(result.byId[wikiId]).toBeUndefined();
            expect(result.byId[wiki2Id]).toEqual(wiki2);
            expect(result.byChannel[channelId]).toEqual([wiki2Id]);
        });
    });

    describe('LOGOUT_SUCCESS', () => {
        test('should reset state to initial state', () => {
            const stateWithWiki = {
                byChannel: {[channelId]: [wikiId]},
                byId: {[wikiId]: mockWiki},
            };

            const action = {
                type: UserTypes.LOGOUT_SUCCESS,
            };

            const result = wikisReducer(stateWithWiki, action);

            expect(result).toEqual(initialState);
        });
    });

    describe('unknown action', () => {
        test('should return current state for unknown actions', () => {
            const stateWithWiki = {
                byChannel: {[channelId]: [wikiId]},
                byId: {[wikiId]: mockWiki},
            };

            const action = {
                type: 'UNKNOWN_ACTION',
            };

            const result = wikisReducer(stateWithWiki, action);

            expect(result).toBe(stateWithWiki);
        });
    });
});
