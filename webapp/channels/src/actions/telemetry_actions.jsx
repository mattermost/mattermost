// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from 'mattermost-redux/client';
import {Preferences} from 'mattermost-redux/constants';
import {getSortedTrackedSelectors} from 'mattermost-redux/selectors/create_selector';
import {getConfig, isPerformanceDebuggingEnabled} from 'mattermost-redux/selectors/entities/general';
import {getBool} from 'mattermost-redux/selectors/entities/preferences';

import {isDevModeEnabled} from 'selectors/general';
import store from 'stores/redux_store';

const HEADER_X_PAGE_LOAD_CONTEXT = 'X-Page-Load-Context';

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
    names.forEach((name) => performance.clearMarks(name));
}

export function mark(name) {
    performance.mark(name);

    if (!shouldTrackPerformance()) {
        return;
    }

    initRequestCountingIfNecessary();
    updateRequestCountAtMark(name);
}

/**
 * Takes the names of two markers and returns the number of requests sent between them.
 *
 * @param   {string} name1 the first marker
 * @param   {string} name2 the second marker
 *
 * @returns {number} Returns a request count of -1 if performance isn't being tracked
 *
 */
export function countRequestsBetween(name1, name2) {
    if (!shouldTrackPerformance()) {
        return -1;
    }

    const requestCount = getRequestCountAtMark(name2) - getRequestCountAtMark(name1);

    return requestCount;
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
        const filteredSelectors = selectors.filter((selector) => selector.calls > 5);

        trackEvent('performance', 'least_effective_selectors', {
            after: 'one_minute',
            first: filteredSelectors[0]?.name || '',
            first_effectiveness: filteredSelectors[0]?.effectiveness,
            first_recomputations: filteredSelectors[0]?.recomputations,
            second: filteredSelectors[1]?.name || '',
            second_effectiveness: filteredSelectors[1]?.effectiveness,
            second_recomputations: filteredSelectors[1]?.recomputations,
            third: filteredSelectors[2]?.name || '',
            third_effectiveness: filteredSelectors[2]?.effectiveness,
            third_recomputations: filteredSelectors[2]?.recomputations,
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

            if (!url.includes('/api/v4/')) {
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

/**
 * This allows the server to know that a given HTTP request occurred during page load or reconnect.
 * The server then uses this information to store metrics fields based on the request context.
 * The setTimeout approach is a "best effort" approach that will produce false positives.
 * A more accurate approach will result in more obtrusive code, which would add risk and maintenance cost.
 */
export const temporarilySetPageLoadContext = (pageLoadContext) => {
    Client4.setHeader(HEADER_X_PAGE_LOAD_CONTEXT, pageLoadContext);
    setTimeout(() => {
        Client4.removeHeader(HEADER_X_PAGE_LOAD_CONTEXT);
    }, 5000);
};
