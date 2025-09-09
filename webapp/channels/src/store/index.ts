// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import baseLocalForage from 'localforage';
import {extendPrototype} from 'localforage-observable';
import type {Store} from 'redux';
import type {Persistor} from 'redux-persist';
import {persistStore, REHYDRATE} from 'redux-persist';
import Observable from 'zen-observable';

import type {DeepPartial} from '@mattermost/types/utilities';

import {General, RequestStatus} from 'mattermost-redux/constants';
import configureServiceStore from 'mattermost-redux/store';

import {cleanLocalStorage} from 'actions/storage';
import {clearUserCookie} from 'actions/views/cookie';
import appReducers from 'reducers';
import {getBasePath} from 'selectors/general';

import type {GlobalState} from 'types/store';

declare global {
    interface Window {
        Observable: typeof Observable;
    }
}

window.Observable = Observable;

const localForage = extendPrototype(baseLocalForage);

export default function configureStore(preloadedState?: DeepPartial<GlobalState>, additionalReducers?: Record<string, any>): Store<GlobalState> {
    const reducers = additionalReducers ? {...appReducers, ...additionalReducers} : appReducers;
    const store = configureServiceStore({
        appReducers: reducers,
        preloadedState,
    });

    localForage.ready().then(() => {
        const persistor: Persistor = persistStore(store, null, () => {
            store.dispatch({
                type: General.STORE_REHYDRATION_COMPLETE,
                complete: true,
            });

            migratePersistedState(store, persistor);
        });

        localForage.configObservables({
            crossTabNotification: true,
        });

        const observable = localForage.newObservable({
            crossTabNotification: true,
            changeDetection: true,
        });

        // Rehydrate redux-persist when another tab changes localForage
        observable.subscribe({
            next: (value) => {
                if (!value.crossTabNotification) {
                    // Ignore changes made by this tab
                    return;
                }

                const keyPrefix = 'persist:';

                if (!value.key.startsWith(keyPrefix)) {
                    // Ignore changes that weren't made by redux-persist
                    return;
                }

                const key = value.key.substring(keyPrefix.length);
                const newValue = JSON.parse(value.newValue);

                const payload: Record<string, any> = {};

                for (const reducerKey of Object.keys(newValue)) {
                    if (reducerKey === '_persist') {
                        // Don't overwrite information used by redux-persist itself
                        continue;
                    }

                    payload[reducerKey] = JSON.parse(newValue[reducerKey]);
                }

                store.dispatch({
                    type: REHYDRATE,
                    key,
                    payload,
                });
            },
        });

        let purging = false;

        // Clean up after a logout
        store.subscribe(() => {
            const state = store.getState();
            const basePath = getBasePath(state);

            if (state.requests.users.logout.status === RequestStatus.SUCCESS && !purging) {
                purging = true;

                persistor.purge().then(() => {
                    cleanLocalStorage();
                    clearUserCookie();

                    // Preserve any query string parameters on logout, including parameters
                    // used by the application such as extra and redirect_to.
                    window.location.href = `${basePath}${window.location.search}`;

                    setTimeout(() => {
                        purging = false;
                    }, 500);
                });
            }
        });
    }).catch((e: Error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to initialize localForage', e);
    });

    return store;
}

/**
 * Migrates state.storage from redux-persist@4 to redux-persist@6
 */
function migratePersistedState(store: Store<GlobalState>, persistor: Persistor): void {
    const oldKeyPrefix = 'reduxPersist:storage:';

    const restoredState: Record<string, string> = {};
    localForage.iterate((value: string, key: string) => {
        if (key && key.startsWith(oldKeyPrefix)) {
            restoredState[key.substring(oldKeyPrefix.length)] = value;
        }
    }).then(async () => {
        if (Object.keys(restoredState).length === 0) {
            // Nothing to migrate
            return;
        }

        // eslint-disable-next-line no-console
        console.log('Migrating storage for redux-persist@6 upgrade');

        persistor.pause();

        const persistedState: Record<string, any> = {};

        for (const [key, value] of Object.entries(restoredState)) {
            // eslint-disable-next-line no-console
            console.log('Migrating `' + key + '`', JSON.parse(value));
            persistedState[key] = JSON.parse(value);
        }

        store.dispatch({
            type: REHYDRATE,
            key: 'storage',
            payload: persistedState,
        });

        // Persist the migrated values and resume
        persistor.persist();

        // Remove the leftover values from localForage
        for (const key of Object.keys(restoredState)) {
            localForage.removeItem(oldKeyPrefix + key);
        }

        // eslint-disable-next-line no-console
        console.log('Done migration for redux-persist@6 upgrade');
    });
}
