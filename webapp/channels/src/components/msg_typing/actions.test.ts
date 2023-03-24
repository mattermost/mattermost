// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getMissingProfilesByIds, getStatusesByIds} from 'mattermost-redux/actions/users';

import {General, WebsocketEvents} from 'mattermost-redux/constants';

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';

import configureStore from 'tests/test_store';

import {userStartedTyping} from './actions';

jest.mock('mattermost-redux/actions/users', () => ({
    getMissingProfilesByIds: jest.fn(() => ({type: 'GET_MISSING_PROFILES_BY_IDS'})),
    getStatusesByIds: jest.fn(() => ({type: 'GET_STATUSES_BY_IDS'})),
}));

describe('handleUserTypingEvent', () => {
    const initialState = {
        entities: {
            general: {
                config: {},
            },
            users: {
                currentUserId: 'user',
                statuses: {},
                users: {},
            },
        },
    };

    const userId = 'otheruser';
    const channelId = 'channel';
    const rootId = 'root';

    test('should dispatch a TYPING event', () => {
        const store = configureStore(initialState);

        store.dispatch(userStartedTyping(userId, channelId, rootId, Date.now()));

        expect(store.getActions().find((action) => action.type === WebsocketEvents.TYPING)).toMatchObject({
            type: WebsocketEvents.TYPING,
            data: {
                id: channelId + rootId,
                userId,
            },
        });
    });

    test('should possibly load missing users and not get again the state', () => {
        const store = configureStore(initialState);

        store.dispatch(userStartedTyping(userId, channelId, rootId, Date.now()));

        expect(getMissingProfilesByIds).toHaveBeenCalledWith([userId]);
        expect(getStatusesByIds).not.toHaveBeenCalled();
    });

    test('should load statuses for users that are not online but are in the store', async () => {
        const state = mergeObjects(initialState, {
            entities: {
                users: {
                    profiles: {
                        otheruser: {
                            id: 'otheruser',
                            roles: 'system_user',
                        },
                    },
                    statuses: {
                        otheruser: General.AWAY,
                    },
                },
            },
        });
        const store = configureStore(state);

        store.dispatch(userStartedTyping(userId, channelId, rootId, Date.now()));

        // Wait for side effects to resolve
        await Promise.resolve();

        expect(getStatusesByIds).toHaveBeenCalled();
    });

    test('should not load statuses for users that are online', async () => {
        const state = mergeObjects(initialState, {
            entities: {
                users: {
                    statuses: {
                        otheruser: General.ONLINE,
                    },
                },
            },
        });
        const store = configureStore(state);

        store.dispatch(userStartedTyping(userId, channelId, rootId, Date.now()));

        // Wait for side effects to resolve
        await Promise.resolve();

        expect(getStatusesByIds).not.toHaveBeenCalled();
    });
});
