// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Store} from 'redux';
import {onCLS, onFCP, onINP, onLCP, onTTFB} from 'web-vitals';
import type {Metric} from 'web-vitals';

import type {Client4} from '@mattermost/client';

import {isTelemetryEnabled} from 'actions/telemetry_actions';

import type {GlobalState} from 'types/store';

type PerformanceReportMeasure = {
    metric: string;
    value: number;

    // TODO timestamp?
}

type PerformanceReport = {

    // TODO confirm the version number that we want to start with
    version: '0';

    // TODO client ID?

    platform: string;
    user_agent: string;

    // TODO start/end timestamp?

    counters: PerformanceReportMeasure[];
    histograms: PerformanceReportMeasure[];
}

export default class PerformanceReporter {
    private client: Client4;
    private store: Store<GlobalState>;

    private counterMeasures: Map<string, number>;
    private histogramMeasures: PerformanceReportMeasure[];

    private observer: PerformanceObserver;
    private reportTimeout: number | undefined;

    protected reportPeriodBase = 60 * 1000;
    protected reportPeriodJitter = 15 * 1000;

    constructor(client: Client4, store: Store<GlobalState>) {
        this.client = client;
        this.store = store;

        this.counterMeasures = new Map();
        this.histogramMeasures = [];

        // This uses a PerformanceObserver to listen for calls to Performance.measure made by frontend code. It's
        // recommended to use an observer rather than to call Performance.getEntriesByName directly
        this.observer = new PerformanceObserver((entries) => this.handleObservations(entries));
    }

    public observe() {
        this.observer.observe({
            entryTypes: ['mark', 'measure'],
            buffered: true,
        });

        // Register handlers for standard metrics and Web Vitals
        onCLS((metric) => this.handleWebVital(metric));
        onFCP((metric) => this.handleWebVital(metric));
        onINP((metric) => this.handleWebVital(metric));
        onLCP((metric) => this.handleWebVital(metric));
        onTTFB((metric) => this.handleWebVital(metric));

        // Periodically send performance telemetry to the server, roughly every minute but with some randomness to
        // avoid overloading the server every minute.
        this.reportTimeout = window.setTimeout(() => this.handleReportTimeout(), this.nextTimeout());

        // Send any remaining metrics when the page becomes hidden rather than when it's unloaded because that's
        // what's recommended by various sites due to unload handlers being unreliable, particularly on mobile.
        addEventListener('visibilitychange', this.handleVisibilityChange);
    }

    /**
     * This method is for testing only because we can't clean up the callbacks registered with web-vitals.
     */
    protected disconnect() {
        removeEventListener('visibilitychange', this.handleVisibilityChange);

        clearTimeout(this.reportTimeout);
        this.reportTimeout = undefined;

        this.observer.disconnect();
    }

    public handleObservations(list: PerformanceObserverEntryList) {
        for (const entry of list.getEntries()) {
            if (isPerformanceMeasure(entry)) {
                this.handleMeasure(entry);
            } else if (isPerformanceMark(entry)) {
                this.handleMark(entry);
            }
        }
    }

    private handleMeasure(entry: PerformanceMeasure) {
        if (!entry.detail?.report) {
            return;
        }

        this.histogramMeasures.push({
            metric: entry.name,
            value: entry.duration,
        });
    }

    private handleMark(entry: PerformanceMeasure) {
        if (!entry.detail?.report) {
            return;
        }

        const current = this.counterMeasures.get(entry.name) ?? 0;
        this.counterMeasures.set(entry.name, current + 1);
    }

    private handleWebVital(metric: Metric) {
        this.histogramMeasures.push({
            metric: metric.name,
            value: metric.value,
        });
    }

    private handleReportTimeout() {
        this.maybeSendMeasures();

        this.reportTimeout = window.setTimeout(() => this.handleReportTimeout(), this.nextTimeout());
    }

    private handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
            this.maybeSendMeasures();
        }
    };

    /** Returns a random timeout for the next report, ranging between 45 seconds and 1 minute 15 seconds. */
    private nextTimeout() {
        // Returns a random value between base-jitter and base+jitter
        const jitter = ((2 * Math.random()) - 1) * this.reportPeriodJitter;
        return this.reportPeriodBase + jitter;
    }

    private maybeSendMeasures() {
        const histogramMeasures = this.histogramMeasures;
        this.histogramMeasures = [];

        const counterMeasures = [];
        for (const [name, value] of this.counterMeasures.entries()) {
            counterMeasures.push({
                metric: name,
                value,
            });
        }
        this.counterMeasures = new Map();

        if (histogramMeasures.length === 0 && counterMeasures.length === 0) {
            return;
        }

        // TODO change this to the new field
        if (!isTelemetryEnabled(this.store.getState())) {
            return;
        }

        const url = this.client.getUrl() + '/api/v4/metrics';

        const report: PerformanceReport = {
            version: '0',

            platform: navigator.platform,
            user_agent: navigator.userAgent,

            counters: counterMeasures,
            histograms: histogramMeasures,
        };
        const data = JSON.stringify(report);

        const beaconSent = navigator.sendBeacon(url, data);

        if (!beaconSent) {
            // The data couldn't be queued as a beacon for some reason, so fall back to sending an immediate fetch
            fetch(url, {method: 'POST', body: data});
        }
    }
}

function isPerformanceMark(entry: PerformanceEntry): entry is PerformanceMark {
    return entry.entryType === 'mark';
}

function isPerformanceMeasure(entry: PerformanceEntry): entry is PerformanceMeasure {
    return entry.entryType === 'measure';
}
