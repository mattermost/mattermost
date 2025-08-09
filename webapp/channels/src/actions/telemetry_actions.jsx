// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from 'mattermost-redux/client';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

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
