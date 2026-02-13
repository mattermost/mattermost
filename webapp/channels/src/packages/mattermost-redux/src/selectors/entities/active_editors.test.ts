// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from '@mattermost/types/store';

import * as Selectors from 'mattermost-redux/selectors/entities/active_editors';

import TestHelper from '../../../test/test_helper';

describe('Selectors.ActiveEditors', () => {
    const pageId1 = TestHelper.generateId();
    const pageId2 = TestHelper.generateId();
    const userId1 = TestHelper.generateId();
    const userId2 = TestHelper.generateId();
    const userId3 = TestHelper.generateId();
    const timestamp = Date.now();

    const testState: Partial<GlobalState> = {
        entities: {
            activeEditors: {
                byPageId: {
                    [pageId1]: {
                        [userId1]: {
                            userId: userId1,
                            lastActivity: timestamp,
                        },
                        [userId2]: {
                            userId: userId2,
                            lastActivity: timestamp - 1000,
                        },
                    },
                    [pageId2]: {
                        [userId3]: {
                            userId: userId3,
                            lastActivity: timestamp - 2000,
                        },
                    },
                },
            },
            users: {
                profiles: {
                    [userId1]: {
                        id: userId1,
                        username: 'user1',
                        email: 'user1@example.com',
                    },
                    [userId2]: {
                        id: userId2,
                        username: 'user2',
                        email: 'user2@example.com',
                    },
                    [userId3]: {
                        id: userId3,
                        username: 'user3',
                        email: 'user3@example.com',
                    },
                },
            },
        },
    } as any;

    describe('getActiveEditorsState', () => {
        it('should return active editors state', () => {
            const result = Selectors.getActiveEditorsState(testState as GlobalState);
            expect(result).toEqual(testState.entities!.activeEditors);
        });
    });

    describe('getActiveEditorsByPageId', () => {
        it('should return editors for a specific page', () => {
            const result = Selectors.getActiveEditorsByPageId(testState as GlobalState, pageId1);
            expect(result).toEqual({
                [userId1]: {
                    userId: userId1,
                    lastActivity: timestamp,
                },
                [userId2]: {
                    userId: userId2,
                    lastActivity: timestamp - 1000,
                },
            });
        });

        it('should return empty object for page with no editors', () => {
            const nonExistentPageId = TestHelper.generateId();
            const result = Selectors.getActiveEditorsByPageId(testState as GlobalState, nonExistentPageId);
            expect(result).toEqual({});
        });
    });

    describe('getActiveEditorsForPage', () => {
        it('should return array of editors for a page', () => {
            const result = Selectors.getActiveEditorsForPage(testState as GlobalState, pageId1);
            expect(result).toHaveLength(2);
            expect(result).toContainEqual({
                userId: userId1,
                lastActivity: timestamp,
            });
            expect(result).toContainEqual({
                userId: userId2,
                lastActivity: timestamp - 1000,
            });
        });

        it('should return empty array for page with no editors', () => {
            const nonExistentPageId = TestHelper.generateId();
            const result = Selectors.getActiveEditorsForPage(testState as GlobalState, nonExistentPageId);
            expect(result).toEqual([]);
            expect(result).toHaveLength(0);
        });

        it('should memoize results', () => {
            const result1 = Selectors.getActiveEditorsForPage(testState as GlobalState, pageId1);
            const result2 = Selectors.getActiveEditorsForPage(testState as GlobalState, pageId1);
            expect(result1).toBe(result2);
        });
    });

    describe('getActiveEditorsWithProfiles', () => {
        it('should return editors with user profiles', () => {
            const result = Selectors.getActiveEditorsWithProfiles(testState as GlobalState, pageId1);
            expect(result).toHaveLength(2);

            const editor1 = result.find((e) => e.userId === userId1);
            expect(editor1).toBeDefined();
            expect(editor1!.user).toEqual({
                id: userId1,
                username: 'user1',
                email: 'user1@example.com',
            });

            const editor2 = result.find((e) => e.userId === userId2);
            expect(editor2).toBeDefined();
            expect(editor2!.user).toEqual({
                id: userId2,
                username: 'user2',
                email: 'user2@example.com',
            });
        });

        it('should filter out editors without user profiles', () => {
            const userId4 = TestHelper.generateId();
            const stateWithMissingUser: Partial<GlobalState> = {
                entities: {
                    activeEditors: {
                        byPageId: {
                            [pageId1]: {
                                [userId1]: {
                                    userId: userId1,
                                    lastActivity: timestamp,
                                },
                                [userId4]: {
                                    userId: userId4,
                                    lastActivity: timestamp,
                                },
                            },
                        },
                    },
                    users: {
                        profiles: {
                            [userId1]: {
                                id: userId1,
                                username: 'user1',
                                email: 'user1@example.com',
                            },
                        },
                    },
                },
            } as any;

            const result = Selectors.getActiveEditorsWithProfiles(stateWithMissingUser as GlobalState, pageId1);
            expect(result).toHaveLength(1);
            expect(result[0].userId).toBe(userId1);
        });

        it('should return empty array for page with no editors', () => {
            const nonExistentPageId = TestHelper.generateId();
            const result = Selectors.getActiveEditorsWithProfiles(testState as GlobalState, nonExistentPageId);
            expect(result).toEqual([]);
        });

        it('should memoize results', () => {
            const result1 = Selectors.getActiveEditorsWithProfiles(testState as GlobalState, pageId1);
            const result2 = Selectors.getActiveEditorsWithProfiles(testState as GlobalState, pageId1);
            expect(result1).toBe(result2);
        });
    });

    describe('getActiveEditorCount', () => {
        it('should return count of active editors for a page', () => {
            const result = Selectors.getActiveEditorCount(testState as GlobalState, pageId1);
            expect(result).toBe(2);
        });

        it('should return 0 for page with no editors', () => {
            const nonExistentPageId = TestHelper.generateId();
            const result = Selectors.getActiveEditorCount(testState as GlobalState, nonExistentPageId);
            expect(result).toBe(0);
        });

        it('should return count for page with single editor', () => {
            const result = Selectors.getActiveEditorCount(testState as GlobalState, pageId2);
            expect(result).toBe(1);
        });
    });
});
