// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from 'types/store';

export const getGlobalItem = <T = any>(state: GlobalState, name: string, defaultValue: T) => {
    const storage = state && state.storage && state.storage.storage;

    return getItemFromStorage<T>(storage, name, defaultValue);
};

export const makeGetGlobalItem = <T = any>(name: string, defaultValue: T) => {
    return (state: GlobalState) => {
        return getGlobalItem<T>(state, name, defaultValue);
    };
};

export const getItemFromStorage = <T = any>(storage: Record<string, any>, name: string, defaultValue: T): T => {
    return storage[name]?.value ?? defaultValue;
};

export const makeGetGlobalItemWithDefault = <T = any>(defaultValue: T) => {
    return (state: GlobalState, name: string) => {
        return getGlobalItem<T>(state, name, defaultValue);
    };
};
