// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Based on https://stackoverflow.com/a/41434763
class LocalStorageMock {
    store: {[key: string]: string};

    constructor() {
        this.store = {};
    }

    clear() {
        this.store = {};
    }

    getItem(key: string): string | null {
        return this.store[key] || null;
    }

    setItem(key: string, value: {toString: () => string}) {
        this.store[key] = value.toString();
    }

    removeItem(key: string) {
        delete this.store[key];
    }
}

(global as any).localStorage = new LocalStorageMock();

export {};
