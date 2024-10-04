// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import localForage from 'localforage';
import type {AnyAction} from 'redux';
import {combineReducers} from 'redux';
import {createMigrate, persistReducer, REHYDRATE} from 'redux-persist';
import type {MigrationManifest, PersistedState} from 'redux-persist';

import {DraftTypes, FileTypes, UserTypes} from 'mattermost-redux/action_types';
import {General} from 'mattermost-redux/constants';

import {StoragePrefixes, StorageTypes} from 'utils/constants';
import {ensureDraft, getDraftInfoFromKey, getDraftKey} from 'utils/storage_utils';

import {isDraftEmpty} from 'types/store/draft';

type StorageEntry = {
    timestamp: Date;
    data: any;
}

function storage(state: Record<string, any> = {}, action: AnyAction) {
    switch (action.type) {
    case REHYDRATE: {
        if (!action.payload || action.key !== 'storage') {
            return state;
        }

        // We have to do some transformation here to correct for the transformation we do when persisting storage state
        const nextState = {...state};

        for (const [key, value] of Object.entries(action.payload)) {
            const nextValue = {...value as StorageEntry};
            if (nextValue.timestamp && typeof nextValue.timestamp === 'string') {
                nextValue.timestamp = new Date(nextValue.timestamp);
            }
            nextState[key] = nextValue;
        }

        return nextState;
    }
    case StorageTypes.SET_GLOBAL_ITEM: {
        if (!state[action.data.name] ||
            !state[action.data.name].timestamp ||
            state[action.data.name].timestamp < action.data.timestamp
        ) {
            const nextState = {...state};
            nextState[action.data.name] = {
                timestamp: action.data.timestamp,
                value: action.data.value,
            };
            return nextState;
        }
        return state;
    }
    case StorageTypes.REMOVE_GLOBAL_ITEM: {
        const nextState = {...state};
        Reflect.deleteProperty(nextState, action.data.name);
        return nextState;
    }
    case StorageTypes.ACTION_ON_GLOBAL_ITEMS_WITH_PREFIX: {
        const nextState = {...state};
        let changed = false;

        for (const key of Object.keys(nextState)) {
            if (!key.startsWith(action.data.prefix)) {
                continue;
            }

            const value = nextState[key].value;
            const nextValue = action.data.action(key, value);
            if (value === nextValue) {
                continue;
            }

            nextState[key] = {
                timestamp: new Date(),
                value: action.data.action(key, state[key].value),
            };
            changed = true;
        }

        return changed ? nextState : state;
    }
    case StorageTypes.STORAGE_REHYDRATE: {
        return {...state, ...action.data};
    }

    case FileTypes.FILE_UPLOAD_STARTED: {
        const key = getDraftKey(action.channelId, action.rootId);

        const draft = ensureDraft(state[key].value, action.channelId, action.rootId);
        const nextDraft = {
            ...draft,
            uploadsInProgress: [...draft.uploadsInProgress, ...action.clientIds],
        };

        return {
            ...state,
            [key]: {
                value: nextDraft,

                // TODO reducers shouldn't have side effects
                timestamp: new Date(),
            },
        };
    }
    case FileTypes.FILE_UPLOAD_COMPLETED: {
        const key = getDraftKey(action.channelId, action.rootId);
        const clientIdsSet = new Set(action.clientIds);

        const draft = ensureDraft(state[key].value, action.channelId, action.rootId);

        const nextDraft = {
            ...draft,
            fileInfos: [...draft.fileInfos, ...action.fileInfos],
            uploadsInProgress: draft.uploadsInProgress.filter((id) => !clientIdsSet.has(id)),
        };

        return {
            ...state,
            [key]: {
                value: nextDraft,

                // TODO reducers shouldn't have side effects
                timestamp: new Date(),
            },
        };
    }
    case FileTypes.FILE_UPLOAD_FAILED: {
        const key = getDraftKey(action.channelId, action.rootId);
        const clientIdsSet = new Set(action.clientIds);

        const draft = ensureDraft(state[key].value, action.channelId, action.rootId);

        const nextDraft = {
            ...draft,
            uploadsInProgress: draft.uploadsInProgress.filter((id) => !clientIdsSet.has(id)),
        };

        return {
            ...state,
            [key]: {
                value: nextDraft,

                // TODO reducers shouldn't have side effects
                timestamp: new Date(),
            },
        };
    }
    case FileTypes.FILE_UPLOAD_REMOVED: {
        const key = getDraftKey(action.channelId, action.rootId);
        const fileIdsSet = new Set(action.fileIds);

        const draft = ensureDraft(state[key].value, action.channelId, action.rootId);

        const nextDraft = {
            ...draft,
            fileInfos: draft.fileInfos.filter((info) => !fileIdsSet.has(info.id)),
            uploadsInProgress: draft.uploadsInProgress.filter((id) => !fileIdsSet.has(id)),
        };

        return {
            ...state,
            [key]: {
                value: nextDraft,

                // TODO reducers shouldn't have side effects
                timestamp: new Date(),
            },
        };
    }

    case DraftTypes.MAKE_DRAFTS_LINK_VISIBLE: {
        const key = getDraftKey(action.channelId, action.rootId);

        if (!state[key] || isDraftEmpty(state[key].value)) {
            return state;
        }

        return {
            ...state,
            [key]: {
                value: {
                    ...state[key].value,
                    show: true,
                },

                // TODO reducers shouldn't have side effects
                timestamp: new Date(),
            },
        };
    }

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function migrateDrafts(state: any) {
    const drafts: any = {};
    for (const storageKey of Object.keys(state)) {
        if (!storageKey.startsWith('draft')) {
            continue;
        }

        const storageDraft = state[storageKey];
        if (storageDraft.value?.channelId) {
            // No migration is needed
            continue;
        }

        const info = getDraftInfoFromKey(storageKey, StoragePrefixes.DRAFT);
        const timestamp = new Date(storageDraft.timestamp);

        if (!info?.id) {
            drafts[storageKey] = {timestamp, value: {message: '', fileInfos: [], uploadsInProgress: []}};
            continue;
        }

        const migratedDraft = {
            timestamp,
            value: {
                message: storageDraft.value?.message,
                fileInfos: storageDraft.value?.fileInfos || [],
                props: storageDraft.value?.props || {},
                uploadsInProgress: storageDraft.value?.uploadsInProgress || [],
                channelId: info.id,
                rootId: '',
                createAt: timestamp.getTime(),
                updateAt: timestamp.getTime(),
                show: true,
            },
        };

        drafts[storageKey] = {...migratedDraft};
    }

    return drafts;
}

function initialized(state = false, action: AnyAction) {
    switch (action.type) {
    case General.STORE_REHYDRATION_COMPLETE:
        return state || action.complete;

    default:
        return state;
    }
}

const migrations: MigrationManifest = {
    1: (state: PersistedState): PersistedState => {
        return {
            ...state,
            ...migrateDrafts(state),
        };
    },
};

const config = {
    key: 'storage',
    version: 1,
    storage: localForage,
    migrate: createMigrate(migrations, {debug: false}),
};

export default combineReducers({
    storage: persistReducer(config, storage),
    initialized,
});
