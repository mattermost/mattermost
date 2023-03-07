// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getRecentEmojisData, getEmojiMap} from 'selectors/emojis';
import * as EmojiActions from 'actions/emoji_actions';
import * as PreferenceActions from 'mattermost-redux/actions/preferences';

import mockStore from 'tests/test_store';

const currentUserId = 'current_user_id';
const initialState = {
    entities: {
        users: {
            currentUserId,
        },
    },
};

jest.mock('selectors/emojis', () => ({
    getRecentEmojisData: jest.fn(),
    getEmojiMap: jest.fn(),
}));

jest.mock('mattermost-redux/actions/preferences', () => ({
    savePreferences: (...args) => ({type: 'RECEIVED_PREFERENCES', args}),
}));

describe('Actions.Emojis', () => {
    let store;
    beforeEach(async () => {
        store = await mockStore(initialState);
    });

    test('Emoji alias is stored in recent emojis', async () => {
        getRecentEmojisData.mockImplementation(() => {
            return [];
        });

        getEmojiMap.mockImplementation(() => {
            return new Map([['grinning', {short_name: 'grinning'}]]);
        });

        const expectedActions = [{
            type: 'RECEIVED_PREFERENCES',
            args: [
                'current_user_id',
                [
                    {
                        category: 'recent_emojis',
                        name: 'current_user_id',
                        user_id: 'current_user_id',
                        value: JSON.stringify([
                            {
                                name: 'grinning',
                                usageCount: 1,
                            },
                        ]),
                    },
                ],
            ],
        }];

        await store.dispatch(EmojiActions.addRecentEmoji('grinning'));
        expect(store.getActions()).toEqual(expectedActions);
    });

    test('First alias is stored in recent emojis even if second alias used', async () => {
        getRecentEmojisData.mockImplementation(() => {
            return [];
        });

        getEmojiMap.mockImplementation(() => {
            return new Map([['thumbsup', {short_name: '+1'}]]);
        });

        const expectedActions = [{
            type: 'RECEIVED_PREFERENCES',
            args: [
                'current_user_id',
                [
                    {
                        category: 'recent_emojis',
                        name: 'current_user_id',
                        user_id: 'current_user_id',
                        value: JSON.stringify([
                            {
                                name: '+1',
                                usageCount: 1,
                            },
                        ]),
                    },
                ],
            ],
        }];

        await store.dispatch(EmojiActions.addRecentEmoji('thumbsup'));
        expect(store.getActions()).toEqual(expectedActions);
    });

    test('Invalid emoji are not stored in recents', async () => {
        getRecentEmojisData.mockImplementation(() => {
            return [];
        });

        getEmojiMap.mockImplementation(() => {
            return new Map([['smile', {short_name: 'smile'}]]);
        });

        const savePreferencesSpy = jest.spyOn(PreferenceActions, 'savePreferences').mockImplementation(() => {
            return {date: true};
        });

        await store.dispatch(EmojiActions.addRecentEmoji('gamgamstyle'));
        expect(savePreferencesSpy).not.toHaveBeenCalled();
    });

    test('Emoji already present in recent should be bumped on the top', async () => {
        getRecentEmojisData.mockImplementation(() => {
            return [
                {name: 'smile', usageCount: 1},
                {name: 'grinning', usageCount: 1},
                {name: 'shell', usageCount: 1},
                {name: 'ladder', usageCount: 1},
            ];
        });

        getEmojiMap.mockImplementation(() => {
            return new Map([['grinning', {short_name: 'grinning'}]]);
        });

        const expectedActions = [{
            type: 'RECEIVED_PREFERENCES',
            args: [
                'current_user_id',
                [
                    {
                        category: 'recent_emojis',
                        name: 'current_user_id',
                        user_id: 'current_user_id',
                        value: JSON.stringify([
                            {name: 'smile', usageCount: 1},
                            {name: 'shell', usageCount: 1},
                            {name: 'ladder', usageCount: 1},
                            {name: 'grinning', usageCount: 2},
                        ]),
                    },
                ],
            ],
        }];

        await store.dispatch(EmojiActions.addRecentEmoji('grinning'));
        expect(store.getActions()).toEqual(expectedActions);
    });

    test('Recent list lenght should always be of size less than or equal to max_recent_size', async () => {
        const recentEmojisList = [
            {name: 'smile', usageCount: 1},
            {name: 'grinning', usageCount: 1},
            {name: 'shell', usageCount: 1},
            {name: 'ladder', usageCount: 1},
            {name: '1', usageCount: 1},
            {name: '2', usageCount: 1},
            {name: '3', usageCount: 1},
            {name: '4', usageCount: 1},
            {name: '5', usageCount: 1},
            {name: '6', usageCount: 1},
            {name: '7', usageCount: 1},
            {name: '8', usageCount: 1},
            {name: '9', usageCount: 1},
            {name: '10', usageCount: 1},
            {name: '11', usageCount: 1},
            {name: '12', usageCount: 1},
            {name: '13', usageCount: 1},
            {name: '14', usageCount: 1},
            {name: '15', usageCount: 1},
            {name: '16', usageCount: 1},
            {name: '17', usageCount: 1},
            {name: '18', usageCount: 1},
            {name: '19', usageCount: 1},
            {name: '20', usageCount: 1},
            {name: '21', usageCount: 1},
            {name: '22', usageCount: 1},
            {name: '23', usageCount: 1},
        ];
        getRecentEmojisData.mockImplementation(() => {
            return recentEmojisList;
        });

        getEmojiMap.mockImplementation(() => {
            return new Map([['accept', {short_name: 'accept'}]]);
        });

        const expectedActions = [{
            type: 'RECEIVED_PREFERENCES',
            args: [
                'current_user_id',
                [
                    {
                        category: 'recent_emojis',
                        name: 'current_user_id',
                        user_id: 'current_user_id',
                        value: JSON.stringify([
                            {name: 'grinning', usageCount: 1},
                            {name: 'shell', usageCount: 1},
                            {name: 'ladder', usageCount: 1},
                            {name: '1', usageCount: 1},
                            {name: '2', usageCount: 1},
                            {name: '3', usageCount: 1},
                            {name: '4', usageCount: 1},
                            {name: '5', usageCount: 1},
                            {name: '6', usageCount: 1},
                            {name: '7', usageCount: 1},
                            {name: '8', usageCount: 1},
                            {name: '9', usageCount: 1},
                            {name: '10', usageCount: 1},
                            {name: '11', usageCount: 1},
                            {name: '12', usageCount: 1},
                            {name: '13', usageCount: 1},
                            {name: '14', usageCount: 1},
                            {name: '15', usageCount: 1},
                            {name: '16', usageCount: 1},
                            {name: '17', usageCount: 1},
                            {name: '18', usageCount: 1},
                            {name: '19', usageCount: 1},
                            {name: '20', usageCount: 1},
                            {name: '21', usageCount: 1},
                            {name: '22', usageCount: 1},
                            {name: '23', usageCount: 1},
                            {name: 'accept', usageCount: 1},
                        ]),
                    },
                ],
            ],
        }];

        await store.dispatch(EmojiActions.addRecentEmoji('accept'));
        expect(store.getActions()).toEqual(expectedActions);
    });
});
