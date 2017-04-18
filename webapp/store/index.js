// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {batchActions} from 'redux-batched-actions';
import {configureOfflineServiceStore} from 'mattermost-redux/store';
import {General, RequestStatus} from 'mattermost-redux/constants';
import reduxInitialState from 'mattermost-redux/store/initial_state';
import {createTransform, persistStore} from 'redux-persist';
import localForage from 'localforage';

import {transformSet} from './utils';

const usersSetTransform = [
    'profilesInChannel',
    'profilesNotInChannel',
    'profilesInTeam',
    'profilesNotInTeam'
];

const teamSetTransform = [
    'membersInTeam'
];

const setTransforms = [
    ...usersSetTransform,
    ...teamSetTransform
];

export default function configureStore(initialState) {
    const setTransformer = createTransform(
        (inboundState, key) => {
            if (key === 'entities') {
                const state = {...inboundState};
                for (const prop in state) {
                    if (state.hasOwnProperty(prop)) {
                        state[prop] = transformSet(state[prop], setTransforms);
                    }
                }

                return state;
            }

            return inboundState;
        },
        (outboundState, key) => {
            if (key === 'entities') {
                const state = {...outboundState};
                for (const prop in state) {
                    if (state.hasOwnProperty(prop)) {
                        state[prop] = transformSet(state[prop], setTransforms, false);
                    }
                }

                return state;
            }

            return outboundState;
        }
    );

    const offlineOptions = {
        persist: (store, options) => {
            const persistor = persistStore(store, {storage: localForage, ...options}, () => {
                store.dispatch({
                    type: General.STORE_REHYDRATION_COMPLETE,
                    complete: true
                });
            });

            let purging = false;

            // check to see if the logout request was successful
            store.subscribe(() => {
                const state = store.getState();
                if (state.requests.users.logout.status === RequestStatus.SUCCESS && !purging) {
                    purging = true;

                    persistor.purge();

                    store.dispatch(batchActions([
                        {
                            type: General.OFFLINE_STORE_RESET,
                            data: Object.assign({}, reduxInitialState, initialState)
                        }
                    ]));

                    setTimeout(() => {
                        purging = false;
                    }, 500);
                }
            });

            return persistor;
        },
        persistOptions: {
            autoRehydrate: {
                log: false
            },
            blacklist: ['errors', 'offline', 'requests', 'entities'],
            debounce: 500,
            transforms: [
                setTransformer
            ]
        }
    };

    return configureOfflineServiceStore({}, offlineOptions);
}

