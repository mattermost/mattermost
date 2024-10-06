// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {waitForObservations} from './performance_mock';

describe('PerformanceObserver', () => {
    test('should be able to observe a mark', async () => {
        const callback = jest.fn();

        const observer = new PerformanceObserver(callback);
        observer.observe({entryTypes: ['mark']});

        const testMark = performance.mark('testMark');

        await waitForObservations();

        expect(callback).toHaveBeenCalledTimes(1);

        const observedEntries = callback.mock.calls[0][0].getEntries();
        expect(observedEntries).toHaveLength(1);
        expect(observedEntries[0]).toBe(testMark);
        expect(observedEntries[0]).toMatchObject({
            entryType: 'mark',
            name: 'testMark',
        });
    });

    test('should be able to observe multiple marks', async () => {
        const callback = jest.fn();

        const observer = new PerformanceObserver(callback);
        observer.observe({entryTypes: ['mark']});

        const testMarkA = performance.mark('testMarkA');
        const testMarkB = performance.mark('testMarkB');

        await waitForObservations();

        expect(callback).toHaveBeenCalledTimes(1);

        // Both marks were batched into a single call
        const observedEntries = callback.mock.calls[0][0].getEntries();
        expect(observedEntries).toHaveLength(2);
        expect(observedEntries[0]).toBe(testMarkA);
        expect(observedEntries[0]).toMatchObject({
            entryType: 'mark',
            name: 'testMarkA',
        });
        expect(observedEntries[1]).toBe(testMarkB);
        expect(observedEntries[1]).toMatchObject({
            entryType: 'mark',
            name: 'testMarkB',
        });
    });

    test('should be able to observe a measure', async () => {
        const callback = jest.fn();

        const observer = new PerformanceObserver(callback);
        observer.observe({entryTypes: ['measure']});

        const testMarkA = performance.mark('testMarkA');
        const testMarkB = performance.mark('testMarkB');
        const testMeasure = performance.measure('testMeasure', 'testMarkA', 'testMarkB');

        await waitForObservations();

        expect(callback).toHaveBeenCalledTimes(1);

        const observedEntries = callback.mock.calls[0][0].getEntries();
        expect(observedEntries).toHaveLength(1);
        expect(observedEntries[0]).toBe(testMeasure);
        expect(observedEntries[0]).toMatchObject({
            entryType: 'measure',
            name: 'testMeasure',
            duration: testMarkB.startTime - testMarkA.startTime,
        });
    });
});
