// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {onCLS, onFCP, onINP, onLCP} from 'web-vitals/attribution';

import {Client4} from '@mattermost/client';

import configureStore from 'store';

import {reset as resetUserAgent, setPlatform, set as setUserAgent} from 'tests/helpers/user_agent_mocks';
import {DesktopAppAPI} from 'utils/desktop_api';

import PerformanceReporter from './reporter';

vi.mock('web-vitals/attribution');

const siteUrl = 'http://localhost:8065';

// Helper to create mock PerformanceObserverEntryList
function createMockEntryList(entries: PerformanceEntry[]): PerformanceObserverEntryList {
    return {
        getEntries: () => entries,
        getEntriesByName: vi.fn(),
        getEntriesByType: vi.fn(),
    } as unknown as PerformanceObserverEntryList;
}

// Helper to create mock measure entries
function createMockMeasure(name: string, duration: number): PerformanceMeasure {
    return {
        name,
        entryType: 'measure',
        duration,
        startTime: 0,
        detail: {report: true},
        toJSON: () => ({}),
    } as PerformanceMeasure;
}

// Helper to create mock mark entries
function createMockMark(name: string, report = true): PerformanceMark {
    return {
        name,
        entryType: 'mark',
        duration: 0,
        startTime: 0,
        detail: {report},
        toJSON: () => ({}),
    } as PerformanceMark;
}

// These tests are good to have, but they're incredibly unreliable in CI. These should be uncommented when making
// changes to this code.
// eslint-disable-next-line no-only-tests/no-only-tests
describe.skip('PerformanceReporter', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        performance.clearMarks();
        performance.clearMeasures();
        vi.useRealTimers();
    });

    // Skip this test because it's flaky
    // eslint-disable-next-line no-only-tests/no-only-tests
    test.skip('should report measurements to the server as histograms', async () => {
        const {reporter, sendBeacon} = newTestReporter();
        reporter.observe();

        expect(sendBeacon).not.toHaveBeenCalled();

        // Simulate performance measures by calling handleObservations directly
        const entries = createMockEntryList([
            createMockMeasure('testMeasureA', 100),
            createMockMeasure('testMeasureB', 200),
            createMockMeasure('testMeasureC', 150),
        ]);

        reporter.handleObservations(entries);
        expect(reporter.handleObservations).toHaveBeenCalled();

        // Advance timers to trigger the report
        vi.advanceTimersByTime(15);

        expect(sendBeacon).toHaveBeenCalled();
        const calls = sendBeacon.mock.calls as unknown[][];
        expect(calls[0][0]).toEqual(siteUrl + '/api/v4/client_perf');
        const report = JSON.parse(calls[0][1] as string);
        expect(report.histograms).toHaveLength(3);
        expect(report.histograms[0].metric).toBe('testMeasureA');
        expect(report.histograms[1].metric).toBe('testMeasureB');
        expect(report.histograms[2].metric).toBe('testMeasureC');
        expect(report.histograms[0].timestamp).toBeDefined();
        expect(report.histograms[1].timestamp).toBeDefined();
        expect(report.histograms[2].timestamp).toBeDefined();

        reporter.disconnect();
    });

    test('should report some marks to the server as counters', async () => {
        const {reporter, sendBeacon} = newTestReporter();
        reporter.observe();

        expect(sendBeacon).not.toHaveBeenCalled();

        // Simulate marks - non-reported marks should be ignored
        const entries = createMockEntryList([
            createMockMark('notReportedA', false),
            createMockMark('notReportedB', false),
            createMockMark('reportedA', true),
            createMockMark('reportedB', true),
            createMockMark('reportedA', true),
            createMockMark('reportedA', true),
        ]);

        reporter.handleObservations(entries);
        expect(reporter.handleObservations).toHaveBeenCalled();

        // Advance timers to trigger the report
        vi.advanceTimersByTime(15);

        expect(sendBeacon).toHaveBeenCalled();
        const calls = sendBeacon.mock.calls as unknown[][];
        expect(calls[0][0]).toEqual(siteUrl + '/api/v4/client_perf');
        const report = JSON.parse(calls[0][1] as string);
        expect(report.counters).toContainEqual(expect.objectContaining({
            metric: 'reportedA',
            value: 3,
        }));
        expect(report.counters).toContainEqual(expect.objectContaining({
            metric: 'reportedB',
            value: 1,
        }));

        reporter.disconnect();
    });

    test('should report longtasks to the server as counters', async () => {
        const {reporter, sendBeacon} = newTestReporter();
        reporter.observe();

        expect(sendBeacon).not.toHaveBeenCalled();

        // Node doesn't support longtask entries, so we fake them
        const entries = createMockEntryList([
            {entryType: 'longtask', duration: 140} as PerformanceEntry,
            {entryType: 'longtask', duration: 68} as PerformanceEntry,
            {entryType: 'longtask', duration: 86} as PerformanceEntry,
        ]);

        reporter.handleObservations(entries);

        // Advance timers to trigger the report
        vi.advanceTimersByTime(15);

        expect(sendBeacon).toHaveBeenCalled();
        const calls = sendBeacon.mock.calls as unknown[][];
        expect(calls[0][0]).toEqual(siteUrl + '/api/v4/client_perf');
        const report = JSON.parse(calls[0][1] as string);
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

        const onCLSCallback = vi.mocked(onCLS).mock.calls[0][0];
        onCLSCallback({name: 'CLS', value: 100} as any);
        const onFCPCallback = vi.mocked(onFCP).mock.calls[0][0];
        onFCPCallback({name: 'FCP', value: 1800} as any);

        // Advance timers to trigger the report
        vi.advanceTimersByTime(15);

        expect(sendBeacon).toHaveBeenCalled();
        let calls = sendBeacon.mock.calls as unknown[][];
        expect(calls[0][0]).toEqual(siteUrl + '/api/v4/client_perf');
        let report = JSON.parse(calls[0][1] as string);
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

        const onINPCallback = vi.mocked(onINP).mock.calls[0][0];
        onINPCallback({name: 'INP', value: 200} as any);
        const onLCPCallback = vi.mocked(onLCP).mock.calls[0][0];
        onLCPCallback({name: 'LCP', value: 2500, entries: []} as any);

        // Advance timers to trigger the report
        vi.advanceTimersByTime(15);

        expect(sendBeacon).toHaveBeenCalled();
        calls = sendBeacon.mock.calls as unknown[][];
        expect(calls[0][0]).toEqual(siteUrl + '/api/v4/client_perf');
        report = JSON.parse(calls[0][1] as string);
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
            ],
        });

        reporter.disconnect();
    });

    test('should not report anything there is no data to report', async () => {
        const {reporter, sendBeacon} = newTestReporter();
        reporter.observe();

        expect(sendBeacon).not.toHaveBeenCalled();

        // Don't add any observations

        // Advance timers to trigger the report
        vi.advanceTimersByTime(15);

        expect(reporter.maybeSendReport).toHaveBeenCalled();
        expect(sendBeacon).not.toHaveBeenCalled();

        reporter.disconnect();
    });

    test('should not report anything if EnableClientMetrics is false', async () => {
        const {reporter, sendBeacon} = newTestReporter(false);
        reporter.observe();

        expect(sendBeacon).not.toHaveBeenCalled();

        // Add some marks to report
        const entries = createMockEntryList([
            createMockMark('reportedA', true),
        ]);
        reporter.handleObservations(entries);

        expect(reporter.handleObservations).toHaveBeenCalled();

        // Advance timers to trigger the report
        vi.advanceTimersByTime(15);

        expect(reporter.maybeSendReport).toHaveBeenCalled();
        expect(sendBeacon).not.toHaveBeenCalled();

        reporter.disconnect();
    });

    test('should not report anything if the user is not logged in', async () => {
        const {reporter, sendBeacon} = newTestReporter(true, false);
        reporter.observe();

        expect(sendBeacon).not.toHaveBeenCalled();

        // Add some marks to report
        const entries = createMockEntryList([
            createMockMark('reportedA', true),
        ]);
        reporter.handleObservations(entries);

        expect(reporter.handleObservations).toHaveBeenCalled();

        // Advance timers to trigger the report
        vi.advanceTimersByTime(15);

        expect(reporter.maybeSendReport).toHaveBeenCalled();
        expect(sendBeacon).not.toHaveBeenCalled();

        reporter.disconnect();
    });

    test('should report user agent and platform', async () => {
        setPlatform('MacIntel');
        setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:124.0) Gecko/20100101 Firefox/124.0');

        const {reporter, sendBeacon} = newTestReporter();
        reporter.observe();

        // Add some marks to report
        const entries = createMockEntryList([
            createMockMark('reportedA', true),
        ]);
        reporter.handleObservations(entries);

        expect(reporter.handleObservations).toHaveBeenCalled();

        // Advance timers to trigger the report
        vi.advanceTimersByTime(15);

        expect(sendBeacon).toHaveBeenCalled();
        const calls = sendBeacon.mock.calls as unknown[][];
        expect(calls[0][0]).toEqual(siteUrl + '/api/v4/client_perf');
        const report = JSON.parse(calls[0][1] as string);
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
        const mockFetch = vi.fn().mockResolvedValue({ok: true});
        vi.stubGlobal('fetch', mockFetch);

        const {
            reporter,
            sendBeacon,
        } = newTestReporter();
        reporter.observe();

        sendBeacon.mockReturnValue(false);

        expect(sendBeacon).not.toHaveBeenCalled();
        expect(mockFetch).not.toHaveBeenCalled();

        // Add some marks to report
        const entries = createMockEntryList([
            createMockMark('reportedA', true),
        ]);
        reporter.handleObservations(entries);

        expect(reporter.handleObservations).toHaveBeenCalled();

        // Advance timers to trigger the report
        vi.advanceTimersByTime(15);

        expect(sendBeacon).toHaveBeenCalled();
        expect(mockFetch).toHaveBeenCalled();
        const fetchCalls = mockFetch.mock.calls as unknown[][];
        expect(fetchCalls[0][0]).toEqual(siteUrl + '/api/v4/client_perf');
        expect(fetchCalls[0][1]).toMatchObject({method: 'POST'});

        reporter.disconnect();
        vi.unstubAllGlobals();
    });
});

class TestPerformanceReporter extends PerformanceReporter {
    public sendBeacon = vi.fn(() => true);
    public reportPeriodBase = 10;
    public reportPeriodJitter = 0;

    public disconnect = super.disconnect;

    public handleObservations = vi.fn(super.handleObservations);

    public maybeSendReport = vi.fn(super.maybeSendReport);
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
    }), new DesktopAppAPI());

    return {
        client,
        reporter,
        sendBeacon: reporter.sendBeacon,
    };
}
