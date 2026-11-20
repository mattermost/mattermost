// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PreferenceTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';

import configureStore from 'store';

import {saveRailListPreference} from './product_rail';

const HIDDEN_KEY = 'sidebar_settings--product_rail_hidden_items';

// A save the test settles by hand.
type PendingSave = {value: string; resolve: () => void; reject: () => void};

describe('saveRailListPreference', () => {
    let saves: PendingSave[];

    beforeEach(() => {
        saves = [];
        jest.spyOn(Client4, 'savePreferences').mockImplementation((_userId, preferences) => new Promise((resolve, reject) => {
            saves.push({
                value: preferences[0].value!,
                resolve: () => resolve({status: 'OK'}),
                reject: () => reject(new Error('save failed')),
            });
        }));
    });

    // Lets queued promise callbacks run.
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

    // Saves are queued across the module, so settle any a test left open before the next one.
    afterEach(async () => {
        for (let i = 0; i < saves.length; i++) {
            saves[i].resolve();
            // eslint-disable-next-line no-await-in-loop
            await flush();
        }
        jest.restoreAllMocks();
    });

    function setUp(initialValue?: string) {
        const store = configureStore();
        if (initialValue !== undefined) {
            store.dispatch({type: PreferenceTypes.RECEIVED_PREFERENCES, data: [{category: 'sidebar_settings', name: 'product_rail_hidden_items', user_id: '', value: initialValue}]});
        }
        const savedValue = () => store.getState().entities.preferences.myPreferences[HIDDEN_KEY]?.value;
        const save = (value: string) => store.dispatch(saveRailListPreference('product_rail_hidden_items', value));
        return {savedValue, save};
    }

    test('should show the new list straight away', async () => {
        const {savedValue, save} = setUp('[]');

        await save('["boards"]');

        expect(savedValue()).toBe('["boards"]');
    });

    test('should send saves one after another, in the order they were made', async () => {
        const {save} = setUp('[]');

        await save('["boards"]');
        await save('["boards","playbooks"]');
        await flush();

        // The second waits for the first to settle.
        expect(saves.map((s) => s.value)).toEqual(['["boards"]']);

        saves[0].resolve();
        await flush();

        expect(saves.map((s) => s.value)).toEqual(['["boards"]', '["boards","playbooks"]']);
    });

    test('should put back the last list the server accepted when a save fails', async () => {
        const {savedValue, save} = setUp('["boards"]');

        await save('["boards","playbooks"]');
        await flush();
        saves[0].reject();
        await flush();

        expect(savedValue()).toBe('["boards"]');
    });

    test('should not undo a newer change when an earlier save fails', async () => {
        const {savedValue, save} = setUp('[]');

        await save('["boards"]');
        await save('["boards","playbooks"]');
        await flush();
        saves[0].reject();
        await flush();

        expect(savedValue()).toBe('["boards","playbooks"]');

        // The newer save then goes through as usual.
        saves[1].resolve();
        await flush();
        expect(savedValue()).toBe('["boards","playbooks"]');
    });

    test('should fall back to the last accepted list when the newest of several saves fails', async () => {
        const {savedValue, save} = setUp('[]');

        await save('["boards"]');
        await save('["boards","playbooks"]');
        await flush();
        saves[0].resolve();
        await flush();
        saves[1].reject();
        await flush();

        expect(savedValue()).toBe('["boards"]');
    });

    test('should remove a preference it created when that first save fails', async () => {
        const {savedValue, save} = setUp();

        await save('["boards"]');
        await flush();
        saves[0].reject();
        await flush();

        expect(savedValue()).toBeUndefined();
    });
});
