// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Reaction} from '@mattermost/types/reactions';
import type {GlobalState} from '@mattermost/types/store';

import {TestHelper} from 'utils/test_helper';

import {makeGetNamesOfUsers} from './index';

describe('makeGetNamesOfUsers', () => {
    test('should sort users by who reacted first', () => {
        const getNamesOfUsers = makeGetNamesOfUsers();

        const post1 = TestHelper.getPostMock({id: 'post1'});

        const user1 = TestHelper.getUserMock({id: 'user1', username: 'username_1'});
        const user2 = TestHelper.getUserMock({id: 'user2', username: 'username_2'});
        const user3 = TestHelper.getUserMock({id: 'user3', username: 'username_3'});

        const baseDate = Date.now();
        const reactions = [
            {user_id: user2.id, create_at: baseDate}, // Will be sorted 2nd, after the logged-in user
            {user_id: user1.id, create_at: baseDate + 5000}, // Logged-in user, will be sorted first although 2nd user reacted first
            {user_id: user3.id, create_at: baseDate + 8000}, // Last to react, will be sorted last
        ] as Reaction[];

        const state = {
            entities: {
                general: {
                    config: {},
                },
                posts: {
                    posts: {
                        post1,
                    },
                    reactions: {
                        post1: reactions,
                    },
                },
                preferences: {
                    myPreferences: {},
                },
                users: {
                    currentUserId: user1.id,
                    profiles: {
                        user1,
                        user2,
                        user3,
                    },
                },
            },
        } as unknown as GlobalState;

        const names = getNamesOfUsers(state, reactions);

        expect(names).toEqual(['You', 'username_2', 'username_3']);
    });
});
