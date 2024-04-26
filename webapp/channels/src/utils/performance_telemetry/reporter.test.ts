// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {onCLS, onFCP, onINP, onLCP, onTTFB} from 'web-vitals';

import {Client4} from '@mattermost/client';

import configureStore from 'store';

import {initializePerformanceMocks, waitForObservations} from 'tests/helpers/performance_mocks';

import PerformanceReporter from './reporter';

import {markAndReport, measureAndReport} from '.';

jest.mock('web-vitals');

initializePerformanceMocks();

const sendBeacon = jest.fn().mockReturnValue(true);
navigator.sendBeacon = sendBeacon;

describe('PerformanceReporter', () => {
    afterEach(() => {
        performance.clearMarks();
        performance.clearMeasures();
    });

    test('should report measurements to the server as histograms', async () => {
        const reporter = newTestReporter();
        reporter.observe();

        expect(sendBeacon).not.toHaveBeenCalled();

        const testMarkA = performance.mark('testMarkA');
        const testMarkB = performance.mark('testMarkB');
        measureAndReport('testMeasure', 'testMarkA', 'testMarkB');

        await waitForObservations();

        expect(reporter.handleObservations).toHaveBeenCalled();

        await waitForReport();

        expect(sendBeacon).toHaveBeenCalled();
        expect(sendBeacon.mock.calls[0][0]).toEqual('/api/v4/metrics');
        const report = JSON.parse(sendBeacon.mock.calls[0][1]);
        expect(report).toMatchObject({
            histograms: [
                {
                    metric: 'testMeasure',
                    value: testMarkB.startTime - testMarkA.startTime,
                },
            ],
        });

        reporter.disconnect();
    });

    test('should report some marks to the server as counters', async () => {
        const reporter = newTestReporter();
        reporter.observe();

        expect(sendBeacon).not.toHaveBeenCalled();

        performance.mark('notReportedA');
        performance.mark('notReportedB');

        markAndReport('reportedA');
        markAndReport('reportedB');
        markAndReport('reportedA');
        markAndReport('reportedA');

        await waitForObservations();

        expect(reporter.handleObservations).toHaveBeenCalled();

        await waitForReport();

        expect(sendBeacon).toHaveBeenCalled();
        expect(sendBeacon.mock.calls[0][0]).toEqual('/api/v4/metrics');
        const report = JSON.parse(sendBeacon.mock.calls[0][1]);
        expect(report).toMatchObject({
            counters: [
                {
                    metric: 'reportedA',
                    value: 3,
                },
                {
                    metric: 'reportedB',
                    value: 1,
                },
            ],
        });

        reporter.disconnect();
    });

    test('should report longtasks to the server as counters', async () => {
        const reporter = newTestReporter();
        reporter.observe();

        expect(sendBeacon).not.toHaveBeenCalled();

        // Node doesn't support longtask entries, and I can't find a way to inject them directly, so we have to fake some
        const entries = {
            getEntries: () => [
                {
                    entryType: 'longtask',
                    duration: 140,
                },
                {
                    entryType: 'longtask',
                    duration: 68,
                },
                {
                    entryType: 'longtask',
                    duration: 86,
                },
            ],
            getEntriesByName: jest.fn(),
            getEntriesByType: jest.fn(),
        } as unknown as PerformanceObserverEntryList;

        reporter.handleObservations(entries);

        await waitForReport();

        expect(sendBeacon).toHaveBeenCalled();
        expect(sendBeacon.mock.calls[0][0]).toEqual('/api/v4/metrics');
        const report = JSON.parse(sendBeacon.mock.calls[0][1]);
        expect(report).toMatchObject({
            counters: [
                {
                    metric: 'long_tasks',
                    value: 3,
                },
            ],
        });

        reporter.disconnect();
    });

    test('should report web vitals to the server as histograms', async () => {
        const reporter = newTestReporter();
        reporter.observe();

        expect(sendBeacon).not.toHaveBeenCalled();

        const onCLSCallback = (onCLS as jest.Mock).mock.calls[0][0];
        onCLSCallback({name: 'CLS', value: 100});
        const onFCPCallback = (onFCP as jest.Mock).mock.calls[0][0];
        onFCPCallback({name: 'FCP', value: 1800});

        await waitForReport();

        expect(sendBeacon).toHaveBeenCalled();
        expect(sendBeacon.mock.calls[0][0]).toEqual('/api/v4/metrics');
        let report = JSON.parse(sendBeacon.mock.calls[0][1]);
        expect(report).toMatchObject({
            histograms: [
                {
                    metric: 'CLS',
                    value: 100,
                },
                {
                    metric: 'FCP',
                    value: 1800,
                },
            ],
        });

        sendBeacon.mockClear();

        const onINPCallback = (onINP as jest.Mock).mock.calls[0][0];
        onINPCallback({name: 'INP', value: 200});
        const onLCPCallback = (onLCP as jest.Mock).mock.calls[0][0];
        onLCPCallback({name: 'LCP', value: 2500});
        const onTTFBCallback = (onTTFB as jest.Mock).mock.calls[0][0];
        onTTFBCallback({name: 'TTFB', value: 800});

        await waitForReport();

        expect(sendBeacon).toHaveBeenCalled();
        expect(sendBeacon.mock.calls[0][0]).toEqual('/api/v4/metrics');
        report = JSON.parse(sendBeacon.mock.calls[0][1]);
        expect(report).toMatchObject({
            histograms: [
                {
                    metric: 'INP',
                    value: 200,
                },
                {
                    metric: 'LCP',
                    value: 2500,
                },
                {
                    metric: 'TTFB',
                    value: 800,
                },
            ],
        });

        reporter.disconnect();
    });

    test('should not report anything if EnableClientMetrics is false', async () => {
        const reporter = newTestReporter(false);
        reporter.observe();

        expect(sendBeacon).not.toHaveBeenCalled();

        markAndReport('reportedA');

        await waitForObservations();

        expect(reporter.handleObservations).toHaveBeenCalled();

        await waitForReport();

        expect(reporter.maybeSendMeasures).toHaveBeenCalled();
        expect(sendBeacon).not.toHaveBeenCalled();
    });

    test('should not report anything if the user is not logged in', async () => {
        const reporter = newTestReporter(true, false);
        reporter.observe();

        expect(sendBeacon).not.toHaveBeenCalled();

        markAndReport('reportedA');

        await waitForObservations();

        expect(reporter.handleObservations).toHaveBeenCalled();

        await waitForReport();

        expect(reporter.maybeSendMeasures).toHaveBeenCalled();
        expect(sendBeacon).not.toHaveBeenCalled();
    });
});

class TestPerformanceReporter extends PerformanceReporter {
    public reportPeriodBase = 10;
    public reportPeriodJitter = 0;

    public disconnect = super.disconnect;

    public handleObservations = jest.fn(super.handleObservations);

    public maybeSendMeasures = jest.fn(super.maybeSendMeasures);
}

function newTestReporter(telemetryEnabled = true, loggedIn = true) {
    return new TestPerformanceReporter(new Client4(), configureStore({
        entities: {
            general: {
                config: {
                    EnableClientMetrics: String(telemetryEnabled),
                },
            },
            users: {
                currentUserId: loggedIn ? 'currentUserId' : '',
            },
        },
    }));
}

function waitForReport() {
    // Reports are set every 10ms by default
    return new Promise((resolve) => setTimeout(resolve, 10));
}
