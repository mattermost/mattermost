// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type StorageItem<T = any> = {
    timestamp: Date;
    value: T;
}

export type StorageInitialized = boolean;

export type StorageState = {
    initialized: StorageInitialized;
    storage: Record<string, StorageItem>;
}
