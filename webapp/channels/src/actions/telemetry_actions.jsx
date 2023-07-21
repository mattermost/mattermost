// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from 'mattermost-redux/client';
import {Preferences} from 'mattermost-redux/constants';
import {getSortedTrackedSelectors} from 'mattermost-redux/selectors/create_selector';
import {getConfig, isPerformanceDebuggingEnabled} from 'mattermost-redux/selectors/entities/general';
import {getBool} from 'mattermost-redux/selectors/entities/preferences';
import {isDevModeEnabled} from 'selectors/general';
import store from 'stores/redux_store.jsx';

const SUPPORTS_CLEAR_MARKS = isSupported([performance.clearMarks]);
const SUPPORTS_MARK = isSupported([performance.mark]);
const SUPPORTS_MEASURE_METHODS = isSupported([
    performance.measure,
    performance.getEntries,
    performance.getEntriesByName,
    performance.clearMeasures,
]);

export function isTelemetryEnabled(state) {
    const config = getConfig(state);
    return config.DiagnosticsEnabled === 'true';
}

export function shouldTrackPerformance(state = store.getState()) {
    return isDevModeEnabled(state) || isTelemetryEnabled(state);
}

export function trackEvent(category, event, props) {
    const state = store.getState();
    if (
        isPerformanceDebuggingEnabled(state) &&
        getBool(state, Preferences.CATEGORY_PERFORMANCE_DEBUGGING, Preferences.NAME_DISABLE_TELEMETRY)
    ) {
        return;
    }

    Client4.trackEvent(category, event, props);

    if (isDevModeEnabled(state) && category === 'performance' && props) {
        // eslint-disable-next-line no-console
        console.log(event + ' - ' + Object.entries(props).map(([key, value]) => `${key}: ${value}`).join(', '));
    }
}

export function pageVisited(category, name) {
    Client4.pageVisited(category, name);
}

/**
 * Takes an array of string names of performance markers and invokes
 * performance.clearMarkers on each.
 * @param   {array} names of markers to clear
 *
 */
export function clearMarks(names) {
    if (!shouldTrackPerformance() || !SUPPORTS_CLEAR_MARKS) {
        return;
    }
    names.forEach((name) => performance.clearMarks(name));
}

export function mark(name) {
    if (!shouldTrackPerformance() || !SUPPORTS_MARK) {
        return;
    }
    performance.mark(name);

    initRequestCountingIfNecessary();
    updateRequestCountAtMark(name);
}

/**
 * Takes the names of two markers and invokes performance.measure on
 * them. The measured duration (ms) and the string name of the measure is
 * are returned.
 *
 * @param   {string} name1 the first marker
 * @param   {string} name2 the second marker
 *
 * @returns {{duration: number; requestCount: number; measurementName: string}}
 * An object containing the measured duration (in ms) between two marks, the
 * number of API requests made during that period, and the name of the measurement.
 * Returns a duration and request count of -1 if performance isn't being tracked
 * or one of the markers can't be found.
 *
 */
export function measure(name1, name2) {
    if (!shouldTrackPerformance() || !SUPPORTS_MEASURE_METHODS) {
        return {duration: -1, requestCount: -1, measurementName: ''};
    }

    // Check for existence of entry name to avoid DOMException
    const performanceEntries = performance.getEntries();
    if (![name1, name2].every((name) => performanceEntries.find((item) => item.name === name))) {
        return {duration: -1, requestCount: -1, measurementName: ''};
    }

    const displayPrefix = '🐐 Mattermost: ';
    const measurementName = `${displayPrefix}${name1} - ${name2}`;
    performance.measure(measurementName, name1, name2);
    const duration = mostRecentDurationByEntryName(measurementName);

    const requestCount = getRequestCountAtMark(name2) - getRequestCountAtMark(name1);

    // Clean up the measures we created
    performance.clearMeasures(measurementName);

    return {duration, requestCount, measurementName};
}

/**
 * Measures the time and number of requests on first page load.
 */
export function measurePageLoadTelemetry() {
    if (!isSupported([
        performance,
        performance.timing.loadEventEnd,
        performance.timing.navigationStart,
        performance.getEntriesByType('resource'),
    ])) {
        return;
    }

    // Must be wrapped in setTimeout because loadEventEnd property is 0
    // until onload is complete, also time added because analytics
    // code isn't loaded until a subsequent window event has fired.
    const tenSeconds = 10000;
    setTimeout(() => {
        const {loadEventEnd, navigationStart} = window.performance.timing;
        const pageLoadTime = loadEventEnd - navigationStart;

        let numOfRequest = 0;
        let maxAPIResourceSize = 0; // in Bytes
        let longestAPIResource = '';
        let longestAPIResourceDuration = 0;
        performance.getEntriesByType('resource').forEach((resourceTimingEntry) => {
            if (resourceTimingEntry.initiatorType === 'xmlhttprequest' || resourceTimingEntry.initiatorType === 'fetch') {
                numOfRequest++;
                maxAPIResourceSize = Math.max(maxAPIResourceSize, resourceTimingEntry.encodedBodySize);

                if (resourceTimingEntry.responseEnd - resourceTimingEntry.startTime > longestAPIResourceDuration) {
                    longestAPIResourceDuration = resourceTimingEntry.responseEnd - resourceTimingEntry.startTime;
                    longestAPIResource = resourceTimingEntry.name?.split('/api/')?.[1] ?? '';
                }
            }
        });

        trackEvent('performance', 'page_load', {duration: pageLoadTime, numOfRequest, maxAPIResourceSize, longestAPIResource, longestAPIResourceDuration});
    }, tenSeconds);
}

function mostRecentDurationByEntryName(entryName) {
    const entriesWithName = performance.getEntriesByName(entryName);
    return entriesWithName.map((item) => item.duration)[entriesWithName.length - 1];
}

function isSupported(checks) {
    for (let i = 0, len = checks.length; i < len; i++) {
        const item = checks[i];
        if (typeof item === 'undefined') {
            return false;
        }
    }
    return true;
}

export function trackPluginInitialization(plugins) {
    if (!shouldTrackPerformance()) {
        return;
    }

    const resourceEntries = performance.getEntriesByType('resource');

    let startTime = Infinity;
    let endTime = 0;
    let totalDuration = 0;
    let totalSize = 0;

    for (const plugin of plugins) {
        const filename = plugin.webapp.bundle_path.substring(plugin.webapp.bundle_path.lastIndexOf('/'));
        const resource = resourceEntries.find((r) => r.name.endsWith(filename));

        if (!resource) {
            // This should never happen, but handle it just in case
            continue;
        }

        startTime = Math.min(resource.startTime, startTime);
        endTime = Math.max(resource.startTime + resource.duration, endTime);
        totalDuration += resource.duration;
        totalSize += resource.encodedBodySize;
    }

    trackEvent('performance', 'plugins_load', {
        count: plugins.length,
        duration: endTime - startTime,
        totalDuration,
        totalSize,
    });
}

export function trackSelectorMetrics() {
    setTimeout(() => {
        if (!shouldTrackPerformance()) {
            return;
        }

        const selectors = getSortedTrackedSelectors();

        trackEvent('performance', 'least_effective_selectors', {
            after: 'one_minute',
            first: selectors[0]?.name || '',
            first_effectiveness: selectors[0]?.effectiveness,
            first_recomputations: selectors[0]?.recomputations,
            second: selectors[1]?.name || '',
            second_effectiveness: selectors[1]?.effectiveness,
            second_recomputations: selectors[1]?.recomputations,
            third: selectors[2]?.name || '',
            third_effectiveness: selectors[2]?.effectiveness,
            third_recomputations: selectors[2]?.recomputations,
        });
    }, 60000);
}

let requestCount = 0;
const requestCountAtMark = {};
let requestObserver;

function initRequestCountingIfNecessary() {
    if (requestObserver) {
        return;
    }

    requestObserver = new PerformanceObserver((entries) => {
        for (const entry of entries.getEntries()) {
            const url = entry.name;

            if (!url.includes('/api/v4/') && !url.includes('/api/v5/')) {
                // Don't count requests made outside of the MM server's API
                continue;
            }

            if (entry.initiatorType !== 'fetch' && entry.initiatorType !== 'xmlhttprequest') {
                // Only look for API requests made by code and ignore things like attachments thumbnails
                continue;
            }

            requestCount += 1;
        }
    });
    requestObserver.observe({type: 'resource', buffered: true});
}

function updateRequestCountAtMark(name) {
    requestCountAtMark[name] = requestCount;
    window.requestCountAtMark = requestCountAtMark;
}

function getRequestCountAtMark(name) {
    return requestCountAtMark[name] ?? 0;
}
