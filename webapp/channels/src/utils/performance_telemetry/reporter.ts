// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Store} from 'redux';
import {onCLS, onFCP, onINP, onLCP} from 'web-vitals/attribution';
import type {INPMetricWithAttribution, LCPMetricWithAttribution, Metric} from 'web-vitals/attribution';

import type {Client4} from '@mattermost/client';

import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import type {DesktopAppAPI} from 'utils/desktop_api';

import type {GlobalState} from 'types/store';

import {identifyElementRegion} from './element_identification';
import type {PerformanceLongTaskTiming} from './long_task';
import type {PlatformLabel, UserAgentLabel} from './platform_detection';
import {getDesktopAppVersionLabel, getPlatformLabel, getUserAgentLabel} from './platform_detection';

import {Measure} from '.';

type PerformanceReportMeasure = {

    /**
     * metric is the name of a counter or histogram metric which must match a MetricType constant as defined in
     * model/metrics.go on the server.
     */
    metric: string;

    /**
     * value is the floating point value of the metric. It's often a millisecond duration, but it's meaning depends
     * on which metric this is.
     */
    value: number;

    /**
     * timestamp is an integer value representing when the metric was measured as a millisecond value. Some browsers
     * use floating point numbers for performance timestamps, so we need to make sure to round this.
     */
    timestamp: number;

    /**
     * labels is an optional map of extra labels to attach to the measure. They must be supported constants as defined
     * in model/metrics.go on the server.
     */
    labels?: Record<string, string>;
}

type PerformanceReport = {
    version: '0.1.0';

    labels: {
        platform: PlatformLabel;
        agent: UserAgentLabel;
        desktop_app_version?: string;
    };

    start: number;
    end: number;

    counters: PerformanceReportMeasure[];
    histograms: PerformanceReportMeasure[];
}

export default class PerformanceReporter {
    private client: Client4;
    private store: Store<GlobalState>;

    private desktopAPI: DesktopAppAPI;
    private desktopOffListener?: () => void;

    private platformLabel: PlatformLabel;
    private userAgentLabel: UserAgentLabel;
    private desktopAppVersion?: string;

    private counters: Map<string, number>;
    private histogramMeasures: PerformanceReportMeasure[];

    private observer: PerformanceObserver;
    private reportTimeout: number | undefined;

    // These values are protected instead of private so that they can be modified by unit tests
    protected reportPeriodBase = 60 * 1000;
    protected reportPeriodJitter = 15 * 1000;

    constructor(client: Client4, store: Store<GlobalState>, desktopAPI: DesktopAppAPI) {
        this.client = client;
        this.store = store;
        this.desktopAPI = desktopAPI;

        this.platformLabel = getPlatformLabel();
        this.userAgentLabel = getUserAgentLabel();

        // We want to submit by prerelease version if it exists, so we don't muddy up the metrics for the release builds
        this.desktopAppVersion = getDesktopAppVersionLabel(desktopAPI.getAppVersion(), desktopAPI.getPrereleaseVersion());

        this.counters = new Map();
        this.histogramMeasures = [];

        // This uses a PerformanceObserver to listen for calls to Performance.measure made by frontend code. It's
        // recommended to use an observer rather than to call Performance.getEntriesByName directly
        this.observer = new PerformanceObserver((entries) => this.handleObservations(entries));
    }

    public observe() {
        const observedEntryTypes = ['mark', 'measure'];
        if (PerformanceObserver.supportedEntryTypes.includes('longtask')) {
            observedEntryTypes.push('longtask');
        }

        this.observer.observe({
            entryTypes: observedEntryTypes,
        });

        // Record the page navigation separately because it arrived before we were observing and because you can't use
        // the buffered option for PerformanceObserver with multiple entry types.
        this.measurePageNavigation();

        // Register handlers for standard metrics and Web Vitals
        onCLS((metric) => this.handleWebVital(metric));
        onFCP((metric) => this.handleWebVital(metric));
        onINP((metric) => this.handleWebVital(metric));
        onLCP((metric) => this.handleWebVital(metric));

        // Periodically send performance telemetry to the server, roughly every minute but with some randomness to
        // avoid overloading the server every minute.
        this.reportTimeout = window.setTimeout(() => this.handleReportTimeout(), this.nextTimeout());

        // Send any remaining metrics when the page becomes hidden rather than when it's unloaded because that's
        // what's recommended by various sites due to unload handlers being unreliable, particularly on mobile.
        addEventListener('visibilitychange', this.handleVisibilityChange);

        if (!this.desktopAPI.isDev()) {
            this.desktopOffListener = this.desktopAPI.onReceiveMetrics((metrics) => this.collectDesktopAppMetrics(metrics));
        }
    }

    private measurePageNavigation() {
        const entries = performance.getEntriesByType('navigation');

        if (entries.length === 0) {
            return;
        }

        const entry = entries[0];
        const ts = Date.now();

        this.histogramMeasures.push({
            metric: Measure.TTFB,
            value: entry.responseStart,
            timestamp: ts,
        });
        this.histogramMeasures.push({
            metric: Measure.TTLB,
            value: entry.responseEnd,
            timestamp: ts,
        });
        this.histogramMeasures.push({
            metric: Measure.DomInteractive,
            value: entry.domInteractive,
            timestamp: ts,
        });
        this.histogramMeasures.push({
            metric: Measure.PageLoad,
            value: entry.duration,
            timestamp: ts,
        });
    }

    /**
     * This method is for testing only because we can't clean up the callbacks registered with web-vitals.
     */
    protected disconnect() {
        removeEventListener('visibilitychange', this.handleVisibilityChange);

        clearTimeout(this.reportTimeout);
        this.reportTimeout = undefined;

        this.observer.disconnect();

        this.desktopOffListener?.();
    }

    protected handleObservations(list: PerformanceObserverEntryList) {
        for (const entry of list.getEntries()) {
            if (isPerformanceMeasure(entry)) {
                this.handleMeasure(entry);
            } else if (isPerformanceMark(entry)) {
                this.handleMark(entry);
            } else if (isPerformanceLongTask(entry)) {
                this.handleLongTask();
            }
        }
    }

    private handleMeasure(entry: PerformanceMeasure) {
        let report;
        try {
            report = Boolean(entry.detail?.report);
        } catch {
            // Measures recorded by browser extensions may be in a separate context which causes accessing
            // entry.detail to throw an error
            report = false;
        }

        if (!report) {
            return;
        }

        this.histogramMeasures.push({
            metric: entry.name,
            value: entry.duration,
            labels: entry.detail.labels,
            timestamp: Date.now(),
        });
    }

    private handleMark(entry: PerformanceMeasure) {
        let report;
        try {
            report = Boolean(entry.detail?.report);
        } catch {
            // Measures recorded by browser extensions may be in a separate context which causes accessing
            // entry.detail to throw an error
            report = false;
        }

        if (!report) {
            return;
        }

        this.incrementCounter(entry.name);
    }

    private handleLongTask() {
        this.incrementCounter('long_tasks');
    }

    private incrementCounter(name: string) {
        const current = this.counters.get(name) ?? 0;
        this.counters.set(name, current + 1);
    }

    private handleWebVital(metric: Metric) {
        let labels: Record<string, string> | undefined;

        if (isLCPMetric(metric)) {
            const selector = metric.attribution?.element;
            const element = selector ? document.querySelector(selector) : null;

            if (element) {
                labels = {
                    region: identifyElementRegion(element),
                };
            }
        } else if (isINPMetric(metric)) {
            labels = {
                interaction: metric.attribution?.interactionType,
            };
        }

        this.histogramMeasures.push({
            metric: metric.name,
            value: metric.value,
            timestamp: Date.now(),
            labels,
        });
    }

    private handleReportTimeout() {
        this.maybeSendReport();

        this.reportTimeout = window.setTimeout(() => this.handleReportTimeout(), this.nextTimeout());
    }

    private handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
            this.maybeSendReport();
        }
    };

    /** Returns a random timeout for the next report, ranging between 45 seconds and 1 minute 15 seconds. */
    private nextTimeout() {
        // Returns a random value between base-jitter and base+jitter
        const jitter = ((2 * Math.random()) - 1) * this.reportPeriodJitter;
        return this.reportPeriodBase + jitter;
    }

    private canReportMetrics() {
        const state = this.store.getState();

        if (getConfig(state).EnableClientMetrics === 'false') {
            return false;
        }

        if (getCurrentUserId(state) === '') {
            return false;
        }

        return true;
    }

    protected maybeSendReport() {
        const histogramMeasures = this.histogramMeasures;
        this.histogramMeasures = [];

        const counters = this.counters;
        this.counters = new Map();

        if (histogramMeasures.length === 0 && counters.size === 0) {
            return;
        }

        if (!this.canReportMetrics()) {
            return;
        }

        this.sendReport(this.generateReport(histogramMeasures, counters));
    }

    private generateReport(histogramMeasures: PerformanceReportMeasure[], counters: Map<string, number>): PerformanceReport {
        const now = Date.now();

        const counterMeasures = this.countersToMeasures(now, counters);

        return {
            version: '0.1.0',

            labels: {
                platform: this.platformLabel,
                agent: this.userAgentLabel,
                desktop_app_version: this.desktopAppVersion,
            },

            ...this.getReportStartEnd(now, histogramMeasures, counterMeasures),

            counters: this.countersToMeasures(now, counters),
            histograms: histogramMeasures,
        };
    }

    private getReportStartEnd(now: number, histogramMeasures: PerformanceReportMeasure[], counterMeasures: PerformanceReportMeasure[]): {start: number; end: number} {
        let start = now;
        let end = 0;

        for (const measure of histogramMeasures) {
            start = Math.min(start, measure.timestamp);
            end = Math.max(end, measure.timestamp);
        }
        for (const measure of counterMeasures) {
            start = Math.min(start, measure.timestamp);
            end = Math.max(end, measure.timestamp);
        }

        return {
            start,
            end,
        };
    }

    private countersToMeasures(now: number, counters: Map<string, number>): PerformanceReportMeasure[] {
        const counterMeasures = [];

        for (const [name, value] of counters.entries()) {
            counterMeasures.push({
                metric: name,
                value,
                timestamp: now,
            });
        }

        return counterMeasures;
    }

    private sendReport(report: PerformanceReport) {
        const url = this.client.getClientMetricsRoute();
        const data = JSON.stringify(report);

        const beaconSent = this.sendBeacon(url, data);

        if (!beaconSent) {
            // The data couldn't be queued as a beacon for some reason, so fall back to sending an immediate fetch
            fetch(url, {method: 'POST', body: data});
        }
    }

    protected sendBeacon(url: string | URL, data?: BodyInit | null | undefined): boolean {
        // Confirm that sendBeacon exists because it doesn't on Firefox with certain settings enabled
        if (!navigator.sendBeacon) {
            return false;
        }

        return navigator.sendBeacon(url, data);
    }

    protected collectDesktopAppMetrics(metricsMap: Map<string, {cpu?: number; memory?: number}>) {
        const now = Date.now();

        for (const [processName, metrics] of metricsMap.entries()) {
            let process = processName;
            if (process.startsWith('Server ')) {
                process = 'Server';
            }

            if (metrics.cpu) {
                this.histogramMeasures.push({
                    metric: 'desktop_cpu',
                    timestamp: now,
                    labels: {process},
                    value: metrics.cpu,
                });
            }

            if (metrics.memory) {
                this.histogramMeasures.push({
                    metric: 'desktop_memory',
                    timestamp: now,
                    labels: {process},
                    value: metrics.memory,
                });
            }
        }
    }
}

function isPerformanceLongTask(entry: PerformanceEntry): entry is PerformanceLongTaskTiming {
    return entry.entryType === 'longtask';
}

function isPerformanceMark(entry: PerformanceEntry): entry is PerformanceMark {
    return entry.entryType === 'mark';
}

function isPerformanceMeasure(entry: PerformanceEntry): entry is PerformanceMeasure {
    return entry.entryType === 'measure';
}

function isLCPMetric(entry: Metric): entry is LCPMetricWithAttribution {
    return entry.name === 'LCP';
}

function isINPMetric(entry: Metric): entry is INPMetricWithAttribution {
    return entry.name === 'INP';
}
