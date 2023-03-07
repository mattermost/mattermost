// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as Actions from 'actions/emoji_actions';
import {getEmojiMap, getRecentEmojisNames} from 'selectors/emojis';

import mockStore from 'tests/test_store';

const initialState = {
    entities: {
        general: {
            config: {EnableCustomEmoji: 'true'},
        },
    },
};

jest.mock('selectors/emojis', () => ({
    getEmojiMap: jest.fn(),
    getRecentEmojisNames: jest.fn(),
}));

jest.mock('mattermost-redux/actions/emojis', () => ({
    getCustomEmojiByName: (...args) => ({type: 'MOCK_GET_CUSTOM_EMOJI_BY_NAME', args}),
}));

describe('loadRecentlyUsedCustomEmojis', () => {
    let testStore;
    beforeEach(async () => {
        testStore = await mockStore(initialState);
    });

    test('Get only emojis missing on the map', async () => {
        getEmojiMap.mockImplementation(() => {
            return new Map([['emoji1', {}], ['emoji3', {}], ['emoji4', {}]]);
        });
        getRecentEmojisNames.mockImplementation(() => {
            return ['emoji1', 'emoji2', 'emoji3', 'emoji5'];
        });

        const expectedActions = [
            {type: 'MOCK_GET_CUSTOM_EMOJI_BY_NAME', args: ['emoji2']},
            {type: 'MOCK_GET_CUSTOM_EMOJI_BY_NAME', args: ['emoji5']},
        ];

        testStore.dispatch(Actions.loadRecentlyUsedCustomEmojis());
        expect(testStore.getActions()).toEqual(expectedActions);
    });

    test('Does not get any emojis if none is missing on the map', async () => {
        getEmojiMap.mockImplementation(() => {
            return new Map([['emoji1', {}], ['emoji3', {}], ['emoji4', {}]]);
        });
        getRecentEmojisNames.mockImplementation(() => {
            return ['emoji1', 'emoji3'];
        });
        const expectedActions = [];

        testStore.dispatch(Actions.loadRecentlyUsedCustomEmojis());
        expect(testStore.getActions()).toEqual(expectedActions);
    });

    test('Does not get any emojis if they are not enabled', async () => {
        testStore = await mockStore({entities: {general: {config: {EnableCustomEmoji: 'false'}}}});
        getEmojiMap.mockImplementation(() => {
            return new Map([['emoji1', {}], ['emoji3', {}], ['emoji4', {}]]);
        });
        getRecentEmojisNames.mockImplementation(() => {
            return ['emoji1', 'emoji2', 'emoji3', 'emoji5'];
        });
        const expectedActions = [];

        testStore.dispatch(Actions.loadRecentlyUsedCustomEmojis());
        expect(testStore.getActions()).toEqual(expectedActions);
    });
});
