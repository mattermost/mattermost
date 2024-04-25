// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {onCLS, onFCP, onINP, onLCP, onTTFB} from 'web-vitals';

import {Client4} from '@mattermost/client';

import configureStore from 'store';

import {initializePerformanceMocks, waitForObservations} from 'tests/helpers/performance_mocks';

import PerformanceReporter from './reporter';

import {measureAndReport} from '.';

jest.mock('web-vitals');

initializePerformanceMocks();

const sendBeacon = jest.fn().mockReturnValue(true);
navigator.sendBeacon = sendBeacon;

describe('PerformanceReporter', () => {
    afterEach(() => {
        performance.clearMarks();
        performance.clearMeasures();
    });

    test('should report measurements to the server periodically', async () => {
        const reporter = newTestReporter();
        reporter.observe();

        expect(sendBeacon).not.toHaveBeenCalled();

        const testMarkA = performance.mark('testMarkA');
        const testMarkB = performance.mark('testMarkB');
        measureAndReport('testMeasure', 'testMarkA', 'testMarkB');

        await waitForObservations();

        expect(reporter.handleMeasures).toHaveBeenCalled();

        await waitForReport();

        expect(sendBeacon).toHaveBeenCalled();
        expect(sendBeacon.mock.calls[0][0]).toEqual('/api/v4/metrics');
        const report = JSON.parse(sendBeacon.mock.calls[0][1]);
        expect(report).toMatchObject({
            measures: [
                {
                    name: 'testMeasure',
                    value: testMarkB.startTime - testMarkA.startTime,
                },
            ],
        });

        reporter.disconnect();
    });

    test('should report web vitals to the server when available', async () => {
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
            measures: [
                {
                    name: 'CLS',
                    value: 100,
                },
                {
                    name: 'FCP',
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
            measures: [
                {
                    name: 'INP',
                    value: 200,
                },
                {
                    name: 'LCP',
                    value: 2500,
                },
                {
                    name: 'TTFB',
                    value: 800,
                },
            ],
        });

        reporter.disconnect();
    });
});

class TestPerformanceReporter extends PerformanceReporter {
    public reportPeriodBase = 10;
    public reportPeriodJitter = 0;

    public disconnect = super.disconnect;

    public handleMeasures = jest.fn(super.handleMeasures);
}

function newTestReporter(telemetryEnabled = true) {
    return new TestPerformanceReporter(new Client4(), configureStore({
        entities: {
            general: {
                config: {
                    DiagnosticsEnabled: String(telemetryEnabled),
                },
            },
        },
    }));
}

function waitForReport() {
    // Reports are set every 10ms by default
    return new Promise((resolve) => setTimeout(resolve, 10));
}
