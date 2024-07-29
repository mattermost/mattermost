// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * A DataLoader is an object that can be used to batch requests for fetching objects from the server for performance
 * reasons.
 */
abstract class DataLoader<Identifier, Result = unknown> {
    protected readonly fetchBatch: (identifiers: Identifier[]) => Result;
    private readonly maxBatchSize: number;

    protected readonly pendingIdentifiers = new Set<Identifier>();

    constructor(args: {
        fetchBatch: (identifiers: Identifier[]) => Result;
        maxBatchSize: number;
    }) {
        this.fetchBatch = args.fetchBatch;
        this.maxBatchSize = args.maxBatchSize;
    }

    public queueForLoading(identifiersToLoad: Identifier[]): void {
        for (const identifier of identifiersToLoad) {
            if (!identifier) {
                continue;
            }

            this.pendingIdentifiers.add(identifier);
        }
    }

    /**
     * startBatch removes an array of identifiers for data to be loaded from pendingIdentifiers and returns it. If
     * pendingIdentifiers contains more than maxBatchSize identifiers, then only that many are returned, but if it
     * contains fewer than that, all of the identifiers are returned and pendingIdentifiers is cleared.
     */
    protected startBatch(): {identifiers: Identifier[]; moreToLoad: boolean} {
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

        return {
            identifiers: identifiersToLoad,
            moreToLoad: this.pendingIdentifiers.size > 0,
        };
    }

    /**
     * isBusy is a method for testing which returns true if the DataLoader is waiting to request or receive any data.
     */
    public isBusy(): boolean {
        return this.pendingIdentifiers.size > 0;
    }
}

/**
 * An IntervalDataLoader is an object that can be used to batch requests for fetching objects from the server. Instead
 * of requesting data immediately, it will periodically check if any objects need to be requested from the server.
 *
 * It's intended to be used for loading low priority data such as information needed in response to WebSocket messages
 * that the user won't see immediately.
 */
export class IntervalDataLoader<Identifier, Result = unknown> extends DataLoader<Identifier, Result> {
    private intervalId: number = -1;

    public startIntervalIfNeeded(ms: number): void {
        if (this.intervalId !== -1) {
            return;
        }

        this.intervalId = window.setInterval(() => this.fetchBatchNow(), ms);
    }

    public stopInterval(): void {
        clearInterval(this.intervalId);
        this.intervalId = -1;
    }

    public fetchBatchNow(): void {
        const {identifiers} = this.startBatch();

        if (identifiers.length === 0) {
            return;
        }

        this.fetchBatch(identifiers);
    }

    public isBusy(): boolean {
        return super.isBusy() || this.intervalId !== -1;
    }
}

/**
 * A DelayedDataLoader is an object that can be used to batch requests for fetching objects from the server. Instead of
 * requesting data immediately, it will wait for an amount of time and then send a request to the server for all of
 * the data which would've been requested during that time.
 *
 * More specifically, when queueForLoading is first called, a timer will be started. Until that timer expires, any other
 * calls to queueForLoading will have the provided identifiers added to the ones from the initial call. When the timer
 * finally expires, the request will be sent to the server to fetch that data. After that, the timer will be reset and
 * the next call to queueForLoading will start a new one.
 *
 * DelayedDataLoader is intended to be used for loading data for components which are unaware of each other and may appear
 * in different places in the UI from each other which could otherwise send repeated requests for the same or similar
 * data as one another.
 */
export class DelayedDataLoader<Identifier> extends DataLoader<Identifier, Promise<unknown>> {
    private readonly wait: number = -1;

    private timeoutId: number = -1;
    private timeoutCallbacks = new Set<{
        identifiers: Set<Identifier>;
        resolve(): void;
    }>();

    constructor(args: {
        fetchBatch: (identifiers: Identifier[]) => Promise<unknown>;
        maxBatchSize: number;
        wait: number;
    }) {
        super(args);

        this.wait = args.wait;
    }

    public queueForLoading(identifiersToLoad: Identifier[]): void {
        super.queueForLoading(identifiersToLoad);

        this.startTimeoutIfNeeded();
    }

    public queueAndWait(identifiersToLoad: Identifier[]): Promise<void> {
        return new Promise((resolve) => {
            super.queueForLoading(identifiersToLoad);

            // Save the callback that will resolve this promise so that the caller of this method can wait for its
            // data to be loaded
            this.timeoutCallbacks.add({
                identifiers: new Set(identifiersToLoad),
                resolve,
            });

            this.startTimeoutIfNeeded();
        });
    }

    private startTimeoutIfNeeded(): void {
        if (this.timeoutId !== -1) {
            return;
        }

        this.timeoutId = window.setTimeout(() => {
            // Ensure that timeoutId and timeoutCallbacks are cleared before doing anything async so that any calls to
            // queueForLoading which come while we're fetching this batch are added to the next batch instead
            this.timeoutId = -1;

            const {identifiers, moreToLoad} = this.startBatch();

            // Start another timeout if there's still more data to load
            if (moreToLoad) {
                this.startTimeoutIfNeeded();
            }

            this.fetchBatch(identifiers).then(() => this.resolveCompletedCallbacks(identifiers));
        }, this.wait);
    }

    private resolveCompletedCallbacks(identifiers: Identifier[]): void {
        for (const callback of this.timeoutCallbacks) {
            for (const identifier of identifiers) {
                callback.identifiers.delete(identifier);
            }

            if (callback.identifiers.size === 0) {
                this.timeoutCallbacks.delete(callback);
                callback.resolve();
            }
        }
    }

    public isBusy(): boolean {
        return super.isBusy() || this.timeoutCallbacks.size > 0 || this.timeoutId !== -1;
    }
}
