// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';

import * as Actions from 'mattermost-redux/actions/active_editors';
import {Client4} from 'mattermost-redux/client';

import TestHelper from '../../test/test_helper';
import configureStore from '../../test/test_store';

describe('Actions.ActiveEditors', () => {
    let store = configureStore();

    beforeAll(() => {
        TestHelper.initBasic(Client4);
    });

    beforeEach(() => {
        store = configureStore();
    });

    afterAll(() => {
        TestHelper.tearDown();
    });

    describe('fetchActiveEditors', () => {
        it('should fetch active editors successfully', async () => {
            const wikiId = TestHelper.generateId();
            const pageId = TestHelper.generateId();
            const userId1 = TestHelper.generateId();
            const userId2 = TestHelper.generateId();
            const timestamp = Date.now();

            const mockResponse = {
                user_ids: [userId1, userId2],
                last_activities: {
                    [userId1]: timestamp,
                    [userId2]: timestamp - 1000,
                },
            };

            nock(Client4.getWikiPageRoute(wikiId, pageId)).
                get('/active_editors').
                reply(200, mockResponse);

            await store.dispatch(Actions.fetchActiveEditors(wikiId, pageId));

            const state = store.getState();
            const activeEditors = state.entities.activeEditors.byPageId[pageId];

            expect(activeEditors).toBeDefined();
            expect(activeEditors[userId1]).toEqual({
                userId: userId1,
                lastActivity: timestamp,
            });
            expect(activeEditors[userId2]).toEqual({
                userId: userId2,
                lastActivity: timestamp - 1000,
            });
        });

        it('should filter out current user from active editors', async () => {
            const wikiId = TestHelper.generateId();
            const pageId = TestHelper.generateId();
            const otherUserId = TestHelper.generateId();
            const timestamp = Date.now();

            const mockResponse = {
                user_ids: [otherUserId],
                last_activities: {
                    [otherUserId]: timestamp,
                },
            };

            nock(Client4.getWikiPageRoute(wikiId, pageId)).
                get('/active_editors').
                reply(200, mockResponse);

            await store.dispatch(Actions.fetchActiveEditors(wikiId, pageId));

            const state = store.getState();
            const activeEditors = state.entities.activeEditors.byPageId[pageId];

            expect(activeEditors[otherUserId]).toBeDefined();
            expect(Object.keys(activeEditors).length).toBe(1);
        });

        it('should handle empty editors list', async () => {
            const wikiId = TestHelper.generateId();
            const pageId = TestHelper.generateId();

            const mockResponse = {
                user_ids: [],
                last_activities: {},
            };

            nock(Client4.getWikiPageRoute(wikiId, pageId)).
                get('/active_editors').
                reply(200, mockResponse);

            await store.dispatch(Actions.fetchActiveEditors(wikiId, pageId));

            const state = store.getState();
            const activeEditors = state.entities.activeEditors.byPageId[pageId];

            expect(activeEditors).toEqual({});
        });
    });

    describe('handleDraftCreated', () => {
        it('should add a new editor', () => {
            const pageId = TestHelper.generateId();
            const userId = TestHelper.generateId();
            const timestamp = Date.now();

            store.dispatch(Actions.handleDraftCreated(pageId, userId, timestamp));

            const state = store.getState();
            const activeEditors = state.entities.activeEditors.byPageId[pageId];

            expect(activeEditors[userId]).toEqual({
                userId,
                lastActivity: timestamp,
            });
        });
    });

    describe('handleDraftUpdated', () => {
        it('should update existing editor timestamp', () => {
            const pageId = TestHelper.generateId();
            const userId = TestHelper.generateId();
            const initialTimestamp = Date.now();
            const updatedTimestamp = Date.now() + 5000;

            store.dispatch(Actions.handleDraftCreated(pageId, userId, initialTimestamp));
            store.dispatch(Actions.handleDraftUpdated(pageId, userId, updatedTimestamp));

            const state = store.getState();
            const activeEditors = state.entities.activeEditors.byPageId[pageId];

            expect(activeEditors[userId].lastActivity).toBe(updatedTimestamp);
        });

        it('should add editor if not exists', () => {
            const pageId = TestHelper.generateId();
            const userId = TestHelper.generateId();
            const timestamp = Date.now();

            store.dispatch(Actions.handleDraftUpdated(pageId, userId, timestamp));

            const state = store.getState();
            const activeEditors = state.entities.activeEditors.byPageId[pageId];

            expect(activeEditors[userId]).toEqual({
                userId,
                lastActivity: timestamp,
            });
        });
    });

    describe('handleDraftDeleted', () => {
        it('should remove editor from list', () => {
            const pageId = TestHelper.generateId();
            const userId1 = TestHelper.generateId();
            const userId2 = TestHelper.generateId();
            const timestamp = Date.now();

            store.dispatch(Actions.handleDraftCreated(pageId, userId1, timestamp));
            store.dispatch(Actions.handleDraftCreated(pageId, userId2, timestamp));

            let state = store.getState();
            expect(state.entities.activeEditors.byPageId[pageId][userId1]).toBeDefined();
            expect(state.entities.activeEditors.byPageId[pageId][userId2]).toBeDefined();

            store.dispatch(Actions.handleDraftDeleted(pageId, userId1));

            state = store.getState();
            expect(state.entities.activeEditors.byPageId[pageId][userId1]).toBeUndefined();
            expect(state.entities.activeEditors.byPageId[pageId][userId2]).toBeDefined();
        });

        it('should clean up empty page entries', () => {
            const pageId = TestHelper.generateId();
            const userId = TestHelper.generateId();
            const timestamp = Date.now();

            store.dispatch(Actions.handleDraftCreated(pageId, userId, timestamp));
            store.dispatch(Actions.handleDraftDeleted(pageId, userId));

            const state = store.getState();
            expect(state.entities.activeEditors.byPageId[pageId]).toBeUndefined();
        });
    });

    describe('removeStaleEditors', () => {
        it('should remove editors older than 5 minutes', () => {
            const pageId = TestHelper.generateId();
            const userId1 = TestHelper.generateId();
            const userId2 = TestHelper.generateId();
            const now = Date.now();
            const staleTimestamp = now - (6 * 60 * 1000);
            const recentTimestamp = now - (2 * 60 * 1000);

            store.dispatch(Actions.handleDraftCreated(pageId, userId1, staleTimestamp));
            store.dispatch(Actions.handleDraftCreated(pageId, userId2, recentTimestamp));

            store.dispatch(Actions.removeStaleEditors(pageId));

            const state = store.getState();
            const activeEditors = state.entities.activeEditors.byPageId[pageId];

            expect(activeEditors[userId1]).toBeUndefined();
            expect(activeEditors[userId2]).toBeDefined();
        });

        it('should clean up empty page entries after removing stale editors', () => {
            const pageId = TestHelper.generateId();
            const userId = TestHelper.generateId();
            const staleTimestamp = Date.now() - (6 * 60 * 1000);

            store.dispatch(Actions.handleDraftCreated(pageId, userId, staleTimestamp));
            store.dispatch(Actions.removeStaleEditors(pageId));

            const state = store.getState();
            expect(state.entities.activeEditors.byPageId[pageId]).toBeUndefined();
        });
    });
});
