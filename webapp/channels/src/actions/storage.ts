// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {StorageTypes} from 'utils/constants';

export function setGlobalItem(name: string, value: any) {
    return {
        type: StorageTypes.SET_GLOBAL_ITEM,
        data: {name, value, timestamp: new Date()},
    };
}

export function removeGlobalItem(name: string) {
    return {
        type: StorageTypes.REMOVE_GLOBAL_ITEM,
        data: {name},
    };
}

export function actionOnGlobalItemsWithPrefix(prefix: string, action: (key: string, value: any) => any) {
    return {
        type: StorageTypes.ACTION_ON_GLOBAL_ITEMS_WITH_PREFIX,
        data: {prefix, action},
    };
}

export function cleanLocalStorage() {
    const userProfileColorPattern = /^[a-z0-9.\-_]+-#[a-z0-9]{6}$/i;

    for (const key of Object.keys(localStorage)) {
        // Remove all keys added for user profile colours before MM-47782
        if (userProfileColorPattern.test(key)) {
            localStorage.removeItem(key);
        }
    }
}
