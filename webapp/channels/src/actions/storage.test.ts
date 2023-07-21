// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as Actions from 'actions/storage';

import configureStore from 'store';

describe('Actions.Storage', () => {
    let store = configureStore();
    beforeEach(async () => {
        store = await configureStore();
    });

    it('setItem', async () => {
        store.dispatch(Actions.setItem('test', 'value'));

        expect(store.getState().storage.storage.unknown_test.value).toBe('value');
        expect(typeof store.getState().storage.storage.unknown_test.timestamp).not.toBe('undefined');
    });

    it('removeItem', async () => {
        store.dispatch(Actions.setItem('test1', 'value1'));
        store.dispatch(Actions.setItem('test2', 'value2'));

        expect(store.getState().storage.storage.unknown_test1.value).toBe('value1');
        expect(store.getState().storage.storage.unknown_test2.value).toBe('value2');

        store.dispatch(Actions.removeItem('test1'));

        expect(typeof store.getState().storage.storage.unknown_test1).toBe('undefined');
        expect(store.getState().storage.storage.unknown_test2.value).toBe('value2');
    });

    it('setGlobalItem', async () => {
        store.dispatch(Actions.setGlobalItem('test', 'value'));

        expect(store.getState().storage.storage.test.value).toBe('value');
        expect(typeof store.getState().storage.storage.test.timestamp).not.toBe('undefined');
    });

    it('removeGlobalItem', async () => {
        store.dispatch(Actions.setGlobalItem('test1', 'value1'));
        store.dispatch(Actions.setGlobalItem('test2', 'value2'));

        expect(store.getState().storage.storage.test1.value).toBe('value1');
        expect(store.getState().storage.storage.test2.value).toBe('value2');

        store.dispatch(Actions.removeGlobalItem('test1'));

        expect(typeof store.getState().storage.storage.test1).toBe('undefined');
        expect(store.getState().storage.storage.test2.value).toBe('value2');
    });

    it('actionOnGlobalItemsWithPrefix', async () => {
        const touchedPairs: Array<[string, number]> = [];

        store.dispatch(Actions.setGlobalItem('prefix_test1', 1));
        store.dispatch(Actions.setGlobalItem('prefix_test2', 2));
        store.dispatch(Actions.setGlobalItem('not_prefix_test', 3));

        store.dispatch(Actions.actionOnGlobalItemsWithPrefix(
            'prefix',
            (key, value) => touchedPairs.push([key, value]),
        ));

        expect(touchedPairs).toEqual([['prefix_test1', 1], ['prefix_test2', 2]]);
    });
});

describe('cleanLocalStorage', () => {
    beforeAll(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    test('should clear keys used for user profile colors in compact mode', () => {
        const keys = [
            'harrison-#0a111f',
            'harrison-#090a0b',
            'jira-#0a111f',
            'jira-#090a0b',
            'github-#090a0b',
        ];

        for (const key of keys) {
            localStorage.setItem(key, key);
        }

        Actions.cleanLocalStorage();

        expect(localStorage.length).toBe(0);
    });

    test('should not clear keys used for other things', () => {
        const keys = [
            'theme',
            'was_logged_in',
            '__landingPageSeen__',
            'emoji-mart.frequently',
        ];

        for (const key of keys) {
            localStorage.setItem(key, key);
        }

        Actions.cleanLocalStorage();

        expect(localStorage.length).toBe(keys.length);
    });
});
