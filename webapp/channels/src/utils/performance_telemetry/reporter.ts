// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Store} from 'redux';
import {onCLS, onFCP, onINP, onLCP, onTTFB} from 'web-vitals';
import type {Metric} from 'web-vitals';

import type {Client4} from '@mattermost/client';

import {isTelemetryEnabled} from 'actions/telemetry_actions';

import type {GlobalState} from 'types/store';

type PerformanceReportMeasure = {
    name: string;
    value: number;
};

type PerformanceReport = {
    measures: PerformanceReportMeasure[];

    platform: string;
    userAgent: string;
}

export default class PerformanceReporter {
    private client: Client4;
    private store: Store<GlobalState>;

    private measures: PerformanceReportMeasure[];

    private observer: PerformanceObserver;
    private reportTimeout: number | undefined;

    protected reportPeriodBase = 60 * 1000;
    protected reportPeriodJitter = 15 * 1000;

    constructor(client: Client4, store: Store<GlobalState>) {
        this.client = client;
        this.store = store;

        this.measures = [];

        // This uses a PerformanceObserver to listen for calls to Performance.measure made by frontend code. It's
        // recommended to use an observer rather than to call Performance.getEntriesByName directly
        this.observer = new PerformanceObserver((list) => this.handleMeasures(list));
    }

    public observe() {
        this.observer.observe({type: 'measure', buffered: true});

        // Register handlers for standard metrics and Web Vitals
        onCLS(this.handleWebVital);
        onFCP(this.handleWebVital);
        onINP(this.handleWebVital);
        onLCP(this.handleWebVital);
        onTTFB(this.handleWebVital);

        // Periodically send performance telemetry to the server, roughly every minute but with some randomness to
        // avoid overloading the server every minute.
        this.reportTimeout = window.setTimeout(() => this.handleReportTimeout(), this.nextTimeout());

        // Send any remaining metrics when the page becomes hidden rather than when it's unloaded because that's
        // what's recommended by various sites due to unload handlers being unreliable, particularly on mobile.
        addEventListener('visibilitychange', () => this.handleVisibilityChange());
    }

    protected handleMeasures(list: PerformanceObserverEntryList) {
        for (const entry of list.getEntries()) {
            if (isPerformanceMeasure(entry) && entry.detail?.report) {
                this.measures.push({
                    name: entry.name,
                    value: entry.duration,
                });
            }
        }
    }

    private handleWebVital(metric: Metric) {
        this.measures.push({
            name: metric.name,
            value: metric.value,
        });
    }

    private handleReportTimeout() {
        this.maybeSendMeasures();

        this.reportTimeout = window.setTimeout(() => this.handleReportTimeout(), this.nextTimeout());
    }

    private handleVisibilityChange() {
        if (document.visibilityState === 'hidden') {
            this.maybeSendMeasures();
        }
    }

    /** Returns a random timeout for the next report, ranging between 45 seconds and 1 minute 15 seconds. */
    private nextTimeout() {
        // Returns a random value between base-jitter and base+jitter
        const jitter = ((2 * Math.random()) - 1) * this.reportPeriodJitter;
        return this.reportPeriodBase + jitter;
    }

    private maybeSendMeasures() {
        const measures = this.measures;
        this.measures = [];

        if (measures.length === 0) {
            return;
        }

        // TODO change this to the new field
        if (!isTelemetryEnabled(this.store.getState())) {
            return;
        }

        const url = this.client.getUrl() + '/api/v4/metrics';

        const report: PerformanceReport = {

            // This assumes that we want the server to bucket the browser and OS
            platform: navigator.platform,
            userAgent: navigator.userAgent,

            measures,
        };
        const data = JSON.stringify(report);

        const beaconSent = navigator.sendBeacon(url, data);

        if (!beaconSent) {
            // The data couldn't be queued as a beacon for some reason, so fall back to sending an immediate fetch
            fetch(url, {method: 'POST', body: data});
        }
    }
}

function isPerformanceMeasure(entry: PerformanceEntry): entry is PerformanceMeasure {
    return entry.entryType === 'measure';
}
