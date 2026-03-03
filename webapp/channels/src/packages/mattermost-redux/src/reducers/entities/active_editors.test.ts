// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UserTypes} from 'mattermost-redux/action_types';
import ActiveEditorsTypes from 'mattermost-redux/action_types/active_editors';
import activeEditorsReducer from 'mattermost-redux/reducers/entities/active_editors';

import TestHelper from '../../../test/test_helper';

describe('Reducers.ActiveEditors', () => {
    it('initial state', () => {
        const state = activeEditorsReducer(
            undefined,
            {type: 'testinit'} as any,
        );
        expect(state).toEqual({
            byPageId: {},
        });
    });

    describe('RECEIVED_ACTIVE_EDITORS', () => {
        it('should set editors for a page', () => {
            const pageId = TestHelper.generateId();
            const userId1 = TestHelper.generateId();
            const userId2 = TestHelper.generateId();
            const timestamp = Date.now();

            const state = activeEditorsReducer(
                undefined,
                {
                    type: ActiveEditorsTypes.RECEIVED_ACTIVE_EDITORS,
                    data: {
                        pageId,
                        editors: [
                            {userId: userId1, lastActivity: timestamp},
                            {userId: userId2, lastActivity: timestamp - 1000},
                        ],
                    },
                } as any,
            );

            expect(state.byPageId[pageId]).toEqual({
                [userId1]: {userId: userId1, lastActivity: timestamp},
                [userId2]: {userId: userId2, lastActivity: timestamp - 1000},
            });
        });

        it('should replace existing editors for a page', () => {
            const pageId = TestHelper.generateId();
            const userId1 = TestHelper.generateId();
            const userId2 = TestHelper.generateId();
            const timestamp = Date.now();

            let state = activeEditorsReducer(
                undefined,
                {
                    type: ActiveEditorsTypes.RECEIVED_ACTIVE_EDITORS,
                    data: {
                        pageId,
                        editors: [
                            {userId: userId1, lastActivity: timestamp},
                        ],
                    },
                } as any,
            );

            state = activeEditorsReducer(
                state,
                {
                    type: ActiveEditorsTypes.RECEIVED_ACTIVE_EDITORS,
                    data: {
                        pageId,
                        editors: [
                            {userId: userId2, lastActivity: timestamp},
                        ],
                    },
                } as any,
            );

            expect(state.byPageId[pageId]).toEqual({
                [userId2]: {userId: userId2, lastActivity: timestamp},
            });
            expect(state.byPageId[pageId][userId1]).toBeUndefined();
        });
    });

    describe('ACTIVE_EDITOR_ADDED', () => {
        it('should add a new editor', () => {
            const pageId = TestHelper.generateId();
            const userId = TestHelper.generateId();
            const timestamp = Date.now();

            const state = activeEditorsReducer(
                undefined,
                {
                    type: ActiveEditorsTypes.ACTIVE_EDITOR_ADDED,
                    data: {
                        pageId,
                        userId,
                        lastActivity: timestamp,
                    },
                } as any,
            );

            expect(state.byPageId[pageId][userId]).toEqual({
                userId,
                lastActivity: timestamp,
            });
        });

        it('should add editor to existing page with other editors', () => {
            const pageId = TestHelper.generateId();
            const userId1 = TestHelper.generateId();
            const userId2 = TestHelper.generateId();
            const timestamp = Date.now();

            let state = activeEditorsReducer(
                undefined,
                {
                    type: ActiveEditorsTypes.ACTIVE_EDITOR_ADDED,
                    data: {
                        pageId,
                        userId: userId1,
                        lastActivity: timestamp,
                    },
                } as any,
            );

            state = activeEditorsReducer(
                state,
                {
                    type: ActiveEditorsTypes.ACTIVE_EDITOR_ADDED,
                    data: {
                        pageId,
                        userId: userId2,
                        lastActivity: timestamp + 1000,
                    },
                } as any,
            );

            expect(state.byPageId[pageId][userId1]).toBeDefined();
            expect(state.byPageId[pageId][userId2]).toBeDefined();
        });
    });

    describe('ACTIVE_EDITOR_UPDATED', () => {
        it('should update existing editor timestamp', () => {
            const pageId = TestHelper.generateId();
            const userId = TestHelper.generateId();
            const initialTimestamp = Date.now();
            const updatedTimestamp = Date.now() + 5000;

            let state = activeEditorsReducer(
                undefined,
                {
                    type: ActiveEditorsTypes.ACTIVE_EDITOR_ADDED,
                    data: {
                        pageId,
                        userId,
                        lastActivity: initialTimestamp,
                    },
                } as any,
            );

            state = activeEditorsReducer(
                state,
                {
                    type: ActiveEditorsTypes.ACTIVE_EDITOR_UPDATED,
                    data: {
                        pageId,
                        userId,
                        lastActivity: updatedTimestamp,
                    },
                } as any,
            );

            expect(state.byPageId[pageId][userId].lastActivity).toBe(updatedTimestamp);
        });

        it('should add editor if not exists', () => {
            const pageId = TestHelper.generateId();
            const userId = TestHelper.generateId();
            const timestamp = Date.now();

            const state = activeEditorsReducer(
                undefined,
                {
                    type: ActiveEditorsTypes.ACTIVE_EDITOR_UPDATED,
                    data: {
                        pageId,
                        userId,
                        lastActivity: timestamp,
                    },
                } as any,
            );

            expect(state.byPageId[pageId][userId]).toEqual({
                userId,
                lastActivity: timestamp,
            });
        });
    });

    describe('ACTIVE_EDITOR_REMOVED', () => {
        it('should remove editor from page', () => {
            const pageId = TestHelper.generateId();
            const userId1 = TestHelper.generateId();
            const userId2 = TestHelper.generateId();
            const timestamp = Date.now();

            let state = activeEditorsReducer(
                undefined,
                {
                    type: ActiveEditorsTypes.RECEIVED_ACTIVE_EDITORS,
                    data: {
                        pageId,
                        editors: [
                            {userId: userId1, lastActivity: timestamp},
                            {userId: userId2, lastActivity: timestamp},
                        ],
                    },
                } as any,
            );

            state = activeEditorsReducer(
                state,
                {
                    type: ActiveEditorsTypes.ACTIVE_EDITOR_REMOVED,
                    data: {
                        pageId,
                        userId: userId1,
                    },
                } as any,
            );

            expect(state.byPageId[pageId][userId1]).toBeUndefined();
            expect(state.byPageId[pageId][userId2]).toBeDefined();
        });

        it('should clean up empty page entries', () => {
            const pageId = TestHelper.generateId();
            const userId = TestHelper.generateId();
            const timestamp = Date.now();

            let state = activeEditorsReducer(
                undefined,
                {
                    type: ActiveEditorsTypes.ACTIVE_EDITOR_ADDED,
                    data: {
                        pageId,
                        userId,
                        lastActivity: timestamp,
                    },
                } as any,
            );

            state = activeEditorsReducer(
                state,
                {
                    type: ActiveEditorsTypes.ACTIVE_EDITOR_REMOVED,
                    data: {
                        pageId,
                        userId,
                    },
                } as any,
            );

            expect(state.byPageId[pageId]).toBeUndefined();
        });

        it('should keep page entry if other editors remain', () => {
            const pageId = TestHelper.generateId();
            const userId1 = TestHelper.generateId();
            const userId2 = TestHelper.generateId();
            const timestamp = Date.now();

            let state = activeEditorsReducer(
                undefined,
                {
                    type: ActiveEditorsTypes.RECEIVED_ACTIVE_EDITORS,
                    data: {
                        pageId,
                        editors: [
                            {userId: userId1, lastActivity: timestamp},
                            {userId: userId2, lastActivity: timestamp},
                        ],
                    },
                } as any,
            );

            state = activeEditorsReducer(
                state,
                {
                    type: ActiveEditorsTypes.ACTIVE_EDITOR_REMOVED,
                    data: {
                        pageId,
                        userId: userId1,
                    },
                } as any,
            );

            expect(state.byPageId[pageId]).toBeDefined();
            expect(state.byPageId[pageId][userId1]).toBeUndefined();
            expect(state.byPageId[pageId][userId2]).toBeDefined();
        });
    });

    describe('STALE_EDITORS_REMOVED', () => {
        it('should remove stale editors', () => {
            const pageId = TestHelper.generateId();
            const userId1 = TestHelper.generateId();
            const userId2 = TestHelper.generateId();
            const now = Date.now();
            const staleTimestamp = now - (6 * 60 * 1000);
            const recentTimestamp = now - (2 * 60 * 1000);

            let state = activeEditorsReducer(
                undefined,
                {
                    type: ActiveEditorsTypes.RECEIVED_ACTIVE_EDITORS,
                    data: {
                        pageId,
                        editors: [
                            {userId: userId1, lastActivity: staleTimestamp},
                            {userId: userId2, lastActivity: recentTimestamp},
                        ],
                    },
                } as any,
            );

            state = activeEditorsReducer(
                state,
                {
                    type: ActiveEditorsTypes.STALE_EDITORS_REMOVED,
                    data: {
                        pageId,
                        staleThreshold: now - (5 * 60 * 1000),
                    },
                } as any,
            );

            expect(state.byPageId[pageId][userId1]).toBeUndefined();
            expect(state.byPageId[pageId][userId2]).toBeDefined();
        });

        it('should clean up empty page entries after removing all stale editors', () => {
            const pageId = TestHelper.generateId();
            const userId = TestHelper.generateId();
            const staleTimestamp = Date.now() - (6 * 60 * 1000);

            let state = activeEditorsReducer(
                undefined,
                {
                    type: ActiveEditorsTypes.ACTIVE_EDITOR_ADDED,
                    data: {
                        pageId,
                        userId,
                        lastActivity: staleTimestamp,
                    },
                } as any,
            );

            state = activeEditorsReducer(
                state,
                {
                    type: ActiveEditorsTypes.STALE_EDITORS_REMOVED,
                    data: {
                        pageId,
                        staleThreshold: Date.now() - (5 * 60 * 1000),
                    },
                } as any,
            );

            expect(state.byPageId[pageId]).toBeUndefined();
        });
    });

    describe('UserTypes.LOGOUT_SUCCESS', () => {
        it('should clear all active editors on logout', () => {
            const pageId1 = TestHelper.generateId();
            const pageId2 = TestHelper.generateId();
            const userId1 = TestHelper.generateId();
            const userId2 = TestHelper.generateId();
            const timestamp = Date.now();

            let state = activeEditorsReducer(
                undefined,
                {
                    type: ActiveEditorsTypes.RECEIVED_ACTIVE_EDITORS,
                    data: {
                        pageId: pageId1,
                        editors: [
                            {userId: userId1, lastActivity: timestamp},
                        ],
                    },
                } as any,
            );

            state = activeEditorsReducer(
                state,
                {
                    type: ActiveEditorsTypes.RECEIVED_ACTIVE_EDITORS,
                    data: {
                        pageId: pageId2,
                        editors: [
                            {userId: userId2, lastActivity: timestamp},
                        ],
                    },
                } as any,
            );

            state = activeEditorsReducer(
                state,
                {
                    type: UserTypes.LOGOUT_SUCCESS,
                } as any,
            );

            expect(state.byPageId).toEqual({});
        });
    });
});
