// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DelayedDataLoader, IntervalDataLoader} from './data_loader';

jest.useFakeTimers();

describe('IntervalDataLoader', () => {
    const maxBatchSize = 10;
    const period = 2000;

    let loader: IntervalDataLoader<string> | undefined;

    afterEach(() => {
        loader?.stopInterval();

        expect(jest.getTimerCount()).toBe(0);
    });

    test('should periodically fetch data from server', () => {
        const fetchBatch = jest.fn();

        loader = new IntervalDataLoader({
            fetchBatch,
            maxBatchSize,
        });

        loader.startIntervalIfNeeded(period);

        loader.addIdsToLoad(['id1']);

        expect(fetchBatch).not.toHaveBeenCalled();

        jest.advanceTimersByTime(period - 1);

        expect(fetchBatch).not.toHaveBeenCalled();

        jest.advanceTimersByTime(1);

        expect(fetchBatch).toHaveBeenCalledTimes(1);
        expect(fetchBatch).toHaveBeenCalledWith(['id1']);

        loader.addIdsToLoad(['id2']);

        expect(fetchBatch).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(period / 2);

        loader.addIdsToLoad(['id3']);
        loader.addIdsToLoad(['id4']);

        expect(fetchBatch).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(period / 2);

        expect(fetchBatch).toHaveBeenCalledTimes(2);
        expect(fetchBatch).toHaveBeenCalledWith(['id2', 'id3', 'id4']);
    });

    test('should dedupe identifiers passed to addIdsToLoad', () => {
        const fetchBatch = jest.fn();

        loader = new IntervalDataLoader({
            fetchBatch,
            maxBatchSize: 10,
        });

        loader.startIntervalIfNeeded(period);

        loader.addIdsToLoad(['id1', 'id1', 'id1']);
        loader.addIdsToLoad(['id2']);
        loader.addIdsToLoad(['id2']);

        jest.advanceTimersToNextTimer();

        expect(fetchBatch).toHaveBeenCalledWith(['id1', 'id2']);
    });

    test("shouldn't fetch data when nothing addIdsToLoad hasn't been called", () => {
        const fetchBatch = jest.fn();

        loader = new IntervalDataLoader({
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

        loader = new IntervalDataLoader({
            fetchBatch,
            maxBatchSize: 3,
        });

        loader.startIntervalIfNeeded(period);

        loader.addIdsToLoad(['id1', 'id2', 'id3', 'id4', 'id5']);

        jest.advanceTimersToNextTimer();

        expect(fetchBatch).toHaveBeenCalledTimes(1);
        expect(fetchBatch).toHaveBeenCalledWith(['id1', 'id2', 'id3']);

        jest.advanceTimersToNextTimer();

        expect(fetchBatch).toHaveBeenCalledTimes(2);
        expect(fetchBatch).toHaveBeenCalledWith(['id4', 'id5']);

        loader.addIdsToLoad(['id6']);
        loader.addIdsToLoad(['id7']);
        loader.addIdsToLoad(['id8']);
        loader.addIdsToLoad(['id9']);

        jest.advanceTimersToNextTimer();

        expect(fetchBatch).toHaveBeenCalledTimes(3);
        expect(fetchBatch).toHaveBeenCalledWith(['id6', 'id7', 'id8']);

        jest.advanceTimersToNextTimer();

        expect(fetchBatch).toHaveBeenCalledTimes(4);
        expect(fetchBatch).toHaveBeenCalledWith(['id9']);
    });

    test('should stop fetching data after stopInterval is called', () => {
        const fetchBatch = jest.fn();

        loader = new IntervalDataLoader({
            fetchBatch,
            maxBatchSize,
        });

        expect(jest.getTimerCount()).toBe(0);

        loader.addIdsToLoad(['id1']);
        loader.startIntervalIfNeeded(period);

        expect(jest.getTimerCount()).toBe(1);

        jest.advanceTimersByTime(period);

        expect(jest.getTimerCount()).toBe(1);
        expect(fetchBatch).toHaveBeenCalledTimes(1);

        loader.addIdsToLoad(['id2']);
        loader.stopInterval();

        expect(jest.getTimerCount()).toBe(0);

        jest.advanceTimersByTime(period);

        expect(fetchBatch).toHaveBeenCalledTimes(1);
    });
});

describe('DelayedDataLoader', () => {
    const maxBatchSize = 10;
    const wait = 50;

    afterEach(() => {
        expect(jest.getTimerCount()).toBe(0);
    });

    test('should send a batch of requests after the delay', () => {
        const fetchBatch = jest.fn(() => Promise.resolve());

        const loader = new DelayedDataLoader({
            fetchBatch,
            maxBatchSize,
            wait,
        });

        expect(jest.getTimerCount()).toBe(0);

        loader.addIdsToLoad(['id1']);

        expect(jest.getTimerCount()).toBe(1);
        expect(fetchBatch).not.toHaveBeenCalled();

        jest.advanceTimersByTime(wait / 2);

        loader.addIdsToLoad(['id2']);
        loader.addIdsToLoad(['id3']);

        expect(jest.getTimerCount()).toBe(1);
        expect(fetchBatch).not.toHaveBeenCalled();

        jest.advanceTimersByTime(wait / 2);

        expect(jest.getTimerCount()).toBe(0);
        expect(fetchBatch).toHaveBeenCalledTimes(1);
        expect(fetchBatch).toHaveBeenCalledWith(['id1', 'id2', 'id3']);
    });

    test('should be able to send multiple batches of requests', () => {
        const fetchBatch = jest.fn(() => Promise.resolve());

        const loader = new DelayedDataLoader({
            fetchBatch,
            maxBatchSize,
            wait,
        });

        loader.addIdsToLoad(['id1']);

        jest.advanceTimersToNextTimer();

        expect(fetchBatch).toHaveBeenCalledTimes(1);
        expect(fetchBatch).toHaveBeenCalledWith(['id1']);

        loader.addIdsToLoad(['id2']);
        loader.addIdsToLoad(['id3']);

        jest.advanceTimersToNextTimer();

        expect(fetchBatch).toHaveBeenCalledTimes(2);
        expect(fetchBatch).toHaveBeenCalledWith(['id2', 'id3']);
    });

    test('should be able to have multiple callers await on addIdsToLoad at once', async () => {
        const fetchBatch = jest.fn().mockResolvedValue(true);

        const loader = new DelayedDataLoader({
            fetchBatch,
            maxBatchSize,
            wait,
        });

        let firstResolved = false;
        loader.addIdsToLoad(['id1']).then(() => {
            firstResolved = true;
        });

        let secondResolved = false;
        loader.addIdsToLoad(['id2']).then(() => {
            secondResolved = true;
        });

        let thirdResolved = false;
        loader.addIdsToLoad(['id3']).then(() => {
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

        const loader = new DelayedDataLoader({
            fetchBatch,
            maxBatchSize,
            wait,
        });

        let firstResolved = false;
        loader.addIdsToLoad(['id1']).then(() => {
            firstResolved = true;
        });

        jest.advanceTimersToNextTimer();

        expect(fetchBatch).toHaveBeenCalledTimes(1);
        expect(fetchBatch).toHaveBeenCalledWith(['id1']);
        expect(firstResolved).toBe(false);

        let secondResolved = false;
        loader.addIdsToLoad(['id2']).then(() => {
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
        loader.addIdsToLoad(['id3']).then(() => {
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
});
