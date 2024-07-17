// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {IntervalDataLoader} from './data_loader';

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
