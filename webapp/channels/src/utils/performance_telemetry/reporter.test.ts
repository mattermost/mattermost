// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';
import {onCLS, onFCP, onINP, onLCP, onTTFB} from 'web-vitals';

import {Client4} from '@mattermost/client';

import configureStore from 'store';

import {reset as resetUserAgent, setPlatform, set as setUserAgent} from 'tests/helpers/user_agent_mocks';
import {waitForObservations} from 'tests/performance_mock';

import PerformanceReporter from './reporter';

import {markAndReport, measureAndReport} from '.';

jest.mock('web-vitals');

const siteUrl = 'http://localhost:8065';

describe('PerformanceReporter', () => {
    afterEach(() => {
        performance.clearMarks();
        performance.clearMeasures();
    });

    test('should report measurements to the server as histograms', async () => {
        const {reporter, sendBeacon} = newTestReporter();
        reporter.observe();

        expect(sendBeacon).not.toHaveBeenCalled();

        const testMarkA = performance.mark('testMarkA');
        const testMarkB = performance.mark('testMarkB');

        const timeA = Date.now();
        measureAndReport('testMeasureA', 'testMarkA', 'testMarkB');

        await waitForObservations();

        const testMarkC = performance.mark('testMarkC');

        const timeBC = Date.now();
        measureAndReport('testMeasureB', 'testMarkA', 'testMarkC');
        measureAndReport('testMeasureC', 'testMarkB', 'testMarkC');

        await waitForObservations();

        expect(reporter.handleObservations).toHaveBeenCalled();

        await waitForReport();

        expect(sendBeacon).toHaveBeenCalled();
        expect(sendBeacon.mock.calls[0][0]).toEqual(siteUrl + '/api/v4/client_perf');
        const report = JSON.parse(sendBeacon.mock.calls[0][1]);
        expect(report).toMatchObject({
            histograms: [
                {
                    metric: 'testMeasureA',
                    value: testMarkB.startTime - testMarkA.startTime,
                },
                {
                    metric: 'testMeasureB',
                    value: testMarkC.startTime - testMarkA.startTime,
                },
                {
                    metric: 'testMeasureC',
                    value: testMarkC.startTime - testMarkB.startTime,
                },
            ],
        });
        expect(report.start).toEqual(report.histograms[0].timestamp);
        expect(report.end).toEqual(report.histograms[2].timestamp);
        expect(report.histograms[0].timestamp).toBeGreaterThanOrEqual(timeA);
        expect(report.histograms[0].timestamp).toBeLessThanOrEqual(timeBC);
        expect(report.histograms[1].timestamp).toBeGreaterThanOrEqual(timeBC);
        expect(report.histograms[2].timestamp).toBeGreaterThanOrEqual(timeBC);

        reporter.disconnect();
    });

    test('should report some marks to the server as counters', async () => {
        const {reporter, sendBeacon} = newTestReporter();
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

        const timestamp = performance.timeOrigin + performance.now();

        await waitForReport();

        expect(sendBeacon).toHaveBeenCalled();
        expect(sendBeacon.mock.calls[0][0]).toEqual(siteUrl + '/api/v4/client_perf');
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
        expect(report.start).toBeGreaterThan(timestamp);
        expect(report.end).toBeGreaterThan(timestamp);
        expect(report.start).toEqual(report.end);

        reporter.disconnect();
    });

    test('should report longtasks to the server as counters', async () => {
        const {reporter, sendBeacon} = newTestReporter();
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
        expect(sendBeacon.mock.calls[0][0]).toEqual(siteUrl + '/api/v4/client_perf');
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
        const {reporter, sendBeacon} = newTestReporter();
        reporter.observe();

        expect(sendBeacon).not.toHaveBeenCalled();

        const onCLSCallback = (onCLS as jest.Mock).mock.calls[0][0];
        onCLSCallback({name: 'CLS', value: 100});
        const onFCPCallback = (onFCP as jest.Mock).mock.calls[0][0];
        onFCPCallback({name: 'FCP', value: 1800});

        await waitForReport();

        expect(sendBeacon).toHaveBeenCalled();
        expect(sendBeacon.mock.calls[0][0]).toEqual(siteUrl + '/api/v4/client_perf');
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
        expect(sendBeacon.mock.calls[0][0]).toEqual(siteUrl + '/api/v4/client_perf');
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

    test('should not report anything there is no data to report', async () => {
        const {reporter, sendBeacon} = newTestReporter();
        reporter.observe();

        expect(sendBeacon).not.toHaveBeenCalled();

        await waitForObservations();

        expect(reporter.handleObservations).not.toHaveBeenCalled();

        await waitForReport();

        expect(reporter.maybeSendReport).toHaveBeenCalled();
        expect(sendBeacon).not.toHaveBeenCalled();

        reporter.disconnect();
    });

    test('should not report anything if EnableClientMetrics is false', async () => {
        const {reporter, sendBeacon} = newTestReporter(false);
        reporter.observe();

        expect(sendBeacon).not.toHaveBeenCalled();

        markAndReport('reportedA');

        await waitForObservations();

        expect(reporter.handleObservations).toHaveBeenCalled();

        await waitForReport();

        expect(reporter.maybeSendReport).toHaveBeenCalled();
        expect(sendBeacon).not.toHaveBeenCalled();

        reporter.disconnect();
    });

    test('should not report anything if the user is not logged in', async () => {
        const {reporter, sendBeacon} = newTestReporter(true, false);
        reporter.observe();

        expect(sendBeacon).not.toHaveBeenCalled();

        markAndReport('reportedA');

        await waitForObservations();

        expect(reporter.handleObservations).toHaveBeenCalled();

        await waitForReport();

        expect(reporter.maybeSendReport).toHaveBeenCalled();
        expect(sendBeacon).not.toHaveBeenCalled();

        reporter.disconnect();
    });

    test('should report user agent and platform', async () => {
        setPlatform('MacIntel');
        setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:124.0) Gecko/20100101 Firefox/124.0');

        const {reporter, sendBeacon} = newTestReporter();
        reporter.observe();

        markAndReport('reportedA');

        await waitForObservations();

        expect(reporter.handleObservations).toHaveBeenCalled();

        await waitForReport();

        expect(sendBeacon).toHaveBeenCalled();
        expect(sendBeacon.mock.calls[0][0]).toEqual(siteUrl + '/api/v4/client_perf');
        const report = JSON.parse(sendBeacon.mock.calls[0][1]);
        expect(report).toMatchObject({
            labels: {
                agent: 'firefox',
                platform: 'macos',
            },
        });

        reporter.disconnect();

        resetUserAgent();
    });

    test('should fall back to making a fetch request if a beacon cannot be sent', async () => {
        const {
            client,
            reporter,
            sendBeacon,
        } = newTestReporter();
        reporter.observe();

        sendBeacon.mockReturnValue(false);
        const mock = nock(client.getBaseRoute()).
            post('/client_perf').
            reply(200);

        expect(sendBeacon).not.toHaveBeenCalled();
        expect(mock.isDone()).toBe(false);

        markAndReport('reportedA');

        await waitForObservations();

        expect(reporter.handleObservations).toHaveBeenCalled();

        await waitForReport();

        expect(sendBeacon).toHaveBeenCalled();
        expect(mock.isDone()).toBe(true);

        reporter.disconnect();
    });
});

class TestPerformanceReporter extends PerformanceReporter {
    public sendBeacon: jest.Mock = jest.fn(() => true);
    public reportPeriodBase = 10;
    public reportPeriodJitter = 0;

    public disconnect = super.disconnect;

    public handleObservations = jest.fn(super.handleObservations);

    public maybeSendReport = jest.fn(super.maybeSendReport);
}

function newTestReporter(telemetryEnabled = true, loggedIn = true) {
    const client = new Client4();
    client.setUrl(siteUrl);

    const reporter = new TestPerformanceReporter(client, configureStore({
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

    return {
        client,
        reporter,
        sendBeacon: reporter.sendBeacon,
    };
}

function waitForReport() {
    // Reports are set every 10ms by default
    return new Promise((resolve) => setTimeout(resolve, 10));
}
