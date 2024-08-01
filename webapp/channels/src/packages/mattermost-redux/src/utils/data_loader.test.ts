// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DelayedDataLoader, BackgroundDataLoader} from './data_loader';

jest.useFakeTimers();

describe('BackgroundDataLoader', () => {
    const maxBatchSize = 10;
    const period = 2000;

    let loader: BackgroundDataLoader<string> | undefined;

    afterEach(() => {
        loader?.stopInterval();
        expect(loader?.isBusy()).toBe(false);

        expect(jest.getTimerCount()).toBe(0);
    });

    test('should periodically fetch data from server', () => {
        const fetchBatch = jest.fn();

        loader = new BackgroundDataLoader({
            fetchBatch,
            maxBatchSize,
        });

        loader.startIntervalIfNeeded(period);

        loader.queue(['id1']);

        expect(fetchBatch).not.toHaveBeenCalled();

        jest.advanceTimersByTime(period - 1);

        expect(fetchBatch).not.toHaveBeenCalled();

        jest.advanceTimersByTime(1);

        expect(fetchBatch).toHaveBeenCalledTimes(1);
        expect(fetchBatch).toHaveBeenCalledWith(['id1']);

        loader.queue(['id2']);

        expect(fetchBatch).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(period / 2);

        loader.queue(['id3']);
        loader.queue(['id4']);

        expect(fetchBatch).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(period / 2);

        expect(fetchBatch).toHaveBeenCalledTimes(2);
        expect(fetchBatch).toHaveBeenCalledWith(['id2', 'id3', 'id4']);
    });

    test('should dedupe identifiers passed to queue', () => {
        const fetchBatch = jest.fn();

        loader = new BackgroundDataLoader({
            fetchBatch,
            maxBatchSize: 10,
        });

        loader.startIntervalIfNeeded(period);

        loader.queue(['id1', 'id1', 'id1']);
        loader.queue(['id2']);
        loader.queue(['id2']);

        jest.advanceTimersToNextTimer();

        expect(fetchBatch).toHaveBeenCalledWith(['id1', 'id2']);
    });

    test("shouldn't fetch data when nothing queue hasn't been called", () => {
        const fetchBatch = jest.fn();

        loader = new BackgroundDataLoader({
            fetchBatch,
            maxBatchSize,
        });

        loader.startIntervalIfNeeded(period);

        expect(jest.getTimerCount()).toBe(1);

        jest.advanceTimersToNextTimer();

        expect(fetchBatch).not.toHaveBeenCalled();
    });

    test('should split requests into batches if too many IDs are added at once', () => {
        const fetchBatch = jest.fn();

        loader = new BackgroundDataLoader({
            fetchBatch,
            maxBatchSize: 3,
        });

        loader.startIntervalIfNeeded(period);

        loader.queue(['id1', 'id2', 'id3', 'id4', 'id5']);

        jest.advanceTimersToNextTimer();

        expect(fetchBatch).toHaveBeenCalledTimes(1);
        expect(fetchBatch).toHaveBeenCalledWith(['id1', 'id2', 'id3']);

        jest.advanceTimersToNextTimer();

        expect(fetchBatch).toHaveBeenCalledTimes(2);
        expect(fetchBatch).toHaveBeenCalledWith(['id4', 'id5']);

        loader.queue(['id6']);
        loader.queue(['id7']);
        loader.queue(['id8']);
        loader.queue(['id9']);

        jest.advanceTimersToNextTimer();

        expect(fetchBatch).toHaveBeenCalledTimes(3);
        expect(fetchBatch).toHaveBeenCalledWith(['id6', 'id7', 'id8']);

        jest.advanceTimersToNextTimer();

        expect(fetchBatch).toHaveBeenCalledTimes(4);
        expect(fetchBatch).toHaveBeenCalledWith(['id9']);
    });

    test('should stop fetching data after stopInterval is called', () => {
        const fetchBatch = jest.fn();

        loader = new BackgroundDataLoader({
            fetchBatch,
            maxBatchSize,
        });

        expect(jest.getTimerCount()).toBe(0);

        loader.queue(['id1']);
        loader.startIntervalIfNeeded(period);

        expect(jest.getTimerCount()).toBe(1);

        jest.advanceTimersByTime(period);

        expect(jest.getTimerCount()).toBe(1);
        expect(fetchBatch).toHaveBeenCalledTimes(1);

        loader.stopInterval();

        expect(jest.getTimerCount()).toBe(0);

        jest.advanceTimersByTime(period);

        expect(fetchBatch).toHaveBeenCalledTimes(1);
    });
});

describe('DelayedDataLoader', () => {
    const maxBatchSize = 10;
    const wait = 50;

    let loader: DelayedDataLoader<string> | undefined;

    afterEach(() => {
        expect(loader?.isBusy()).toBe(false);

        expect(jest.getTimerCount()).toBe(0);
    });

    test('should send a batch of requests after the delay', () => {
        const fetchBatch = jest.fn(() => Promise.resolve());

        loader = new DelayedDataLoader({
            fetchBatch,
            maxBatchSize,
            wait,
        });

        expect(jest.getTimerCount()).toBe(0);

        loader.queue(['id1']);

        expect(jest.getTimerCount()).toBe(1);
        expect(fetchBatch).not.toHaveBeenCalled();

        jest.advanceTimersByTime(wait / 2);

        loader.queue(['id2']);
        loader.queue(['id3']);

        expect(jest.getTimerCount()).toBe(1);
        expect(fetchBatch).not.toHaveBeenCalled();

        jest.advanceTimersByTime(wait / 2);

        expect(jest.getTimerCount()).toBe(0);
        expect(fetchBatch).toHaveBeenCalledTimes(1);
        expect(fetchBatch).toHaveBeenCalledWith(['id1', 'id2', 'id3']);
    });

    test('should be able to send multiple batches of requests', () => {
        const fetchBatch = jest.fn(() => Promise.resolve());

        loader = new DelayedDataLoader({
            fetchBatch,
            maxBatchSize,
            wait,
        });

        loader.queue(['id1']);

        jest.advanceTimersToNextTimer();

        expect(fetchBatch).toHaveBeenCalledTimes(1);
        expect(fetchBatch).toHaveBeenCalledWith(['id1']);

        loader.queue(['id2']);
        loader.queue(['id3']);

        jest.advanceTimersToNextTimer();

        expect(fetchBatch).toHaveBeenCalledTimes(2);
        expect(fetchBatch).toHaveBeenCalledWith(['id2', 'id3']);
    });

    test('should be able to have multiple callers await on queueAndWait at once', async () => {
        const fetchBatch = jest.fn().mockResolvedValue(true);

        loader = new DelayedDataLoader({
            fetchBatch,
            maxBatchSize,
            wait,
        });

        let firstResolved = false;
        loader.queueAndWait(['id1']).then(() => {
            firstResolved = true;
        });

        let secondResolved = false;
        loader.queueAndWait(['id2']).then(() => {
            secondResolved = true;
        });

        let thirdResolved = false;
        loader.queueAndWait(['id3']).then(() => {
            thirdResolved = true;
        });

        jest.advanceTimersByTime(wait - 1);

        expect(jest.getTimerCount()).toBe(1);
        expect(firstResolved).toBe(false);
        expect(secondResolved).toBe(false);
        expect(thirdResolved).toBe(false);

        jest.advanceTimersByTime(1);

        // The timer has run and fetchBatch has started, but the .then calls in this test won't have run yet
        expect(jest.getTimerCount()).toBe(0);

        expect(firstResolved).toBe(false);
        expect(secondResolved).toBe(false);
        expect(thirdResolved).toBe(false);

        // We need to wait twice: once for fetchBatch to resolve and then once for the .then calls to resolve
        await Promise.resolve();
        await Promise.resolve();

        expect(firstResolved).toBe(true);
        expect(secondResolved).toBe(true);
        expect(thirdResolved).toBe(true);
    });

    test('should be able to start a new batch while the first one is in-progress', async () => {
        const fetchBatch = jest.fn().mockResolvedValue(true);

        loader = new DelayedDataLoader({
            fetchBatch,
            maxBatchSize,
            wait,
        });

        let firstResolved = false;
        loader.queueAndWait(['id1']).then(() => {
            firstResolved = true;
        });

        jest.advanceTimersToNextTimer();

        expect(fetchBatch).toHaveBeenCalledTimes(1);
        expect(fetchBatch).toHaveBeenCalledWith(['id1']);
        expect(firstResolved).toBe(false);

        let secondResolved = false;
        loader.queueAndWait(['id2']).then(() => {
            secondResolved = true;
        });

        // Wait twice as in the previous test
        await Promise.resolve();
        await Promise.resolve();

        expect(fetchBatch).toHaveBeenCalledTimes(1);
        expect(firstResolved).toBe(true);
        expect(secondResolved).toBe(false);

        jest.advanceTimersToNextTimer();

        expect(fetchBatch).toHaveBeenCalledTimes(2);
        expect(fetchBatch).toHaveBeenCalledWith(['id2']);
        expect(secondResolved).toBe(false);

        // Similar to above, wait once...
        await Promise.resolve();

        // ...start a third batch...
        let thirdResolved = false;
        loader.queueAndWait(['id3']).then(() => {
            thirdResolved = true;
        });

        // and then wait the second time
        await Promise.resolve();

        expect(fetchBatch).toHaveBeenCalledTimes(2);
        expect(secondResolved).toBe(true);
        expect(thirdResolved).toBe(false);

        jest.advanceTimersToNextTimer();

        expect(fetchBatch).toHaveBeenCalledTimes(3);
        expect(fetchBatch).toHaveBeenCalledWith(['id3']);
        expect(thirdResolved).toBe(false);

        await Promise.resolve();
        await Promise.resolve();

        expect(fetchBatch).toHaveBeenCalledTimes(3);
        expect(thirdResolved).toBe(true);
    });

    test('should split requests into batches if too many IDs are added at once', () => {
        const fetchBatch = jest.fn(() => Promise.resolve());

        loader = new DelayedDataLoader({
            fetchBatch,
            maxBatchSize: 3,
            wait,
        });

        loader.queue(['id1', 'id2', 'id3', 'id4', 'id5']);

        jest.advanceTimersToNextTimer();

        expect(fetchBatch).toHaveBeenCalledTimes(1);
        expect(fetchBatch).toHaveBeenCalledWith(['id1', 'id2', 'id3']);

        // A new timeout should have started to get the second batch of data
        expect(jest.getTimerCount()).toBe(1);

        jest.advanceTimersToNextTimer();

        expect(fetchBatch).toHaveBeenCalledTimes(2);
        expect(fetchBatch).toHaveBeenCalledWith(['id4', 'id5']);
    });

    test('should split requests into batches if too many IDs are added across multiple calls', () => {
        const fetchBatch = jest.fn(() => Promise.resolve());

        loader = new DelayedDataLoader({
            fetchBatch,
            maxBatchSize: 3,
            wait,
        });

        loader.queue(['id1', 'id2']);
        loader.queue(['id3', 'id4']);

        jest.advanceTimersToNextTimer();

        expect(fetchBatch).toHaveBeenCalledTimes(1);
        expect(fetchBatch).toHaveBeenCalledWith(['id1', 'id2', 'id3']);

        // A new timeout should have started to get the second batch of data
        expect(jest.getTimerCount()).toBe(1);

        jest.advanceTimersToNextTimer();

        expect(fetchBatch).toHaveBeenCalledTimes(2);
        expect(fetchBatch).toHaveBeenCalledWith(['id4']);
    });

    test('should wait until all of the data requested is received before resolving a promise', async () => {
        const fetchBatch = jest.fn(() => Promise.resolve());

        loader = new DelayedDataLoader({
            fetchBatch,
            maxBatchSize: 3,
            wait,
        });

        let firstResolved = false;
        loader.queueAndWait(['id1', 'id2']).then(() => {
            firstResolved = true;
        });

        let secondResolved = false;
        loader.queueAndWait(['id3', 'id4']).then(() => {
            secondResolved = true;
        });

        jest.advanceTimersToNextTimer();

        expect(fetchBatch).toHaveBeenCalledTimes(1);
        expect(fetchBatch).toHaveBeenCalledWith(['id1', 'id2', 'id3']);

        expect(firstResolved).toBe(false);
        expect(secondResolved).toBe(false);

        await Promise.resolve();
        await Promise.resolve();

        // The first promise should be resolved since all of its data has been received, but the second one shouldn't
        expect(firstResolved).toBe(true);
        expect(secondResolved).toBe(false);

        // A new timer should've started to get the rest of the data
        expect(jest.getTimerCount()).toBe(1);

        jest.advanceTimersToNextTimer();

        expect(fetchBatch).toHaveBeenCalledTimes(2);
        expect(fetchBatch).toHaveBeenCalledWith(['id4']);

        await Promise.resolve();
        await Promise.resolve();

        expect(firstResolved).toBe(true);
        expect(secondResolved).toBe(true);
    });

    test('should correctly split and wait for data to be requested while still deduping identifiers', async () => {
        const fetchBatch = jest.fn(() => Promise.resolve());

        loader = new DelayedDataLoader({
            fetchBatch,
            maxBatchSize: 3,
            wait,
        });

        let firstResolved = false;
        loader.queueAndWait(['id1', 'id2']).then(() => {
            firstResolved = true;
        });

        let secondResolved = false;
        loader.queueAndWait(['id3', 'id2']).then(() => {
            secondResolved = true;
        });

        let thirdResolved = false;
        loader.queueAndWait(['id3', 'id4']).then(() => {
            thirdResolved = true;
        });

        let fourthResolved = false;
        loader.queueAndWait(['id2', 'id3']).then(() => {
            fourthResolved = true;
        });

        let fifthResolved = false;
        loader.queueAndWait(['id3', 'id4', 'id5', 'id6', 'id7']).then(() => {
            fifthResolved = true;
        });

        // First batch
        jest.advanceTimersToNextTimer();

        expect(fetchBatch).toHaveBeenCalledTimes(1);
        expect(fetchBatch).toHaveBeenCalledWith(['id1', 'id2', 'id3']);

        await Promise.resolve();
        await Promise.resolve();

        expect(firstResolved).toBe(true);
        expect(secondResolved).toBe(true);
        expect(thirdResolved).toBe(false);
        expect(fourthResolved).toBe(true);
        expect(fifthResolved).toBe(false);

        // Second batch
        jest.advanceTimersToNextTimer();

        expect(fetchBatch).toHaveBeenCalledTimes(2);
        expect(fetchBatch).toHaveBeenCalledWith(['id4', 'id5', 'id6']);

        await Promise.resolve();
        await Promise.resolve();

        expect(firstResolved).toBe(true);
        expect(secondResolved).toBe(true);
        expect(thirdResolved).toBe(true);
        expect(fourthResolved).toBe(true);
        expect(fifthResolved).toBe(false);

        // Third batch
        jest.advanceTimersToNextTimer();

        expect(fetchBatch).toHaveBeenCalledTimes(3);
        expect(fetchBatch).toHaveBeenCalledWith(['id7']);

        await Promise.resolve();
        await Promise.resolve();

        expect(firstResolved).toBe(true);
        expect(secondResolved).toBe(true);
        expect(thirdResolved).toBe(true);
        expect(fourthResolved).toBe(true);
        expect(fifthResolved).toBe(true);
    });
});
