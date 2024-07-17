// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * A DataLoader is an object that can be used to batch requests for fetching objects from the server for performance
 * reasons.
 */
abstract class DataLoader<Identifier> {
    private fetchBatch: (identifiers: Identifier[]) => void;
    private maxBatchSize: number;

    private pendingIdentifiers = new Set<Identifier>();

    constructor(args: {
        fetchBatch: (identifiers: Identifier[]) => void;
        maxBatchSize: number;
    }) {
        this.fetchBatch = args.fetchBatch;
        this.maxBatchSize = args.maxBatchSize;
    }

    public addIdsToLoad(identifiersToLoad: Identifier[]) {
        for (const identifier of identifiersToLoad) {
            if (!identifier) {
                continue;
            }

            this.pendingIdentifiers.add(identifier);
        }
    }

    public doFetchBatch() {
        let identifiersToLoad;

        // Since we can only fetch a defined number of user statuses at a time, we need to batch the requests
        if (this.pendingIdentifiers.size >= this.maxBatchSize) {
            identifiersToLoad = [];

            // We use temp buffer here to store up until max buffer size
            // and clear out processed user ids
            for (const identifier of this.pendingIdentifiers) {
                identifiersToLoad.push(identifier);
                this.pendingIdentifiers.delete(identifier);

                if (identifiersToLoad.length >= this.maxBatchSize) {
                    break;
                }
            }
        } else {
            // If we have less than max buffer size, we can directly fetch the statuses
            identifiersToLoad = Array.from(this.pendingIdentifiers);
            this.pendingIdentifiers.clear();
        }

        if (identifiersToLoad.length > 0) {
            this.fetchBatch(identifiersToLoad);
        }
    }
}

/**
 * An IntervalDataLoader is an object that can be used to batch requests for fetching objects from the server. Instead
 * of requesting data immediately, it will periodically check if any objects need to be requested from the server.
 *
 * It's intended to be used for loading low priority data such as information needed in response to WebSocket messages
 * that the user won't see immediately.
 */
export class IntervalDataLoader<Identifier> extends DataLoader<Identifier> {
    private intervalId: number = -1;

    startIntervalIfNeeded(ms: number) {
        if (this.intervalId !== -1) {
            return;
        }

        this.intervalId = window.setInterval(() => this.doFetchBatch(), ms);
    }

    stopInterval() {
        clearInterval(this.intervalId);
        this.intervalId = -1;
    }
}
