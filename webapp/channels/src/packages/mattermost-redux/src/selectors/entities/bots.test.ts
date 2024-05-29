// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as Selectors from 'mattermost-redux/selectors/entities/bots';
import deepFreezeAndThrowOnMutation from 'mattermost-redux/utils/deep_freeze';

describe('Selectors.Bots', () => {
    const userID1 = 'currentUser';
    const userID2 = 'otherUser1';
    const userID3 = 'otherUser2';

    const currentUser = {id: userID1, username: 'currentUser', first_name: 'Current', last_name: 'User', locale: 'en'};
    const otherUser1 = {id: userID2, username: 'otherUser1', first_name: 'Other', last_name: 'User', locale: 'en'};
    const otherUser2 = {id: userID3, username: 'mattermost-advisor', first_name: 'Another', last_name: 'User', locale: 'en'};

    const bot1 = {
        user_id: userID1,
        username: 'currentUser',
        display_name: 'abc',
        description: '',
        owner_id: 'abc',
        create_at: 1553808969975,
        update_at: 1553808969975,
        delete_at: 0,
    };
    const bot2 = {
        user_id: userID3,
        username: 'mattermost-advisor',
        display_name: 'xyz',
        description: '',
        owner_id: 'xyz',
        create_at: 1553808972099,
        update_at: 1553808972099,
        delete_at: 0,
    };
    const testState = deepFreezeAndThrowOnMutation({
        entities: {
            bots: {
                syncables: {},
                members: {},
                accounts: {
                    [userID1]: bot1,
                    [userID3]: bot2,
                },
            },
            users: {
                profiles: {
                    currentUser,
                    otherUser1,
                    otherUser2,
                },
            },
        },
    });

    it('getBotAccounts', () => {
        const botsById = Selectors.getBotAccounts(testState);
        expect(botsById[bot1.user_id]).toEqual(bot1);
        expect(botsById[bot2.user_id]).toEqual(bot2);
        expect(Object.keys(botsById).length).toEqual(2);
    });

    it('getExternalBotAccounts', () => {
        const expected = {
            currentUser: bot1,
        };
        expect(Selectors.getExternalBotAccounts(testState)).toEqual(expected);
    });
});
