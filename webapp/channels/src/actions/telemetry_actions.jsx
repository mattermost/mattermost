// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from 'mattermost-redux/client';

const HEADER_X_PAGE_LOAD_CONTEXT = 'X-Page-Load-Context';

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
