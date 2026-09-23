// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {logError, LogErrorBarMode} from 'mattermost-redux/actions/errors';

import store from 'stores/redux_store';

import {AnnouncementBarTypes} from 'utils/constants';

// Benign Chromium ResizeObserver noise (Monaco automaticLayout, etc.).
// Covers both "loop limit exceeded" and "loop completed with undelivered notifications."
function isBenign(description: string) {
    return description.startsWith('ResizeObserver loop');
}

function report(message: string, stack?: string, url?: string) {
    store.dispatch(
        logError(
            {
                type: AnnouncementBarTypes.DEVELOPER,
                message,
                stack,
                url,
            },
            {errorBarMode: LogErrorBarMode.InDevMode},
        ),
    );
}

function handleError(event: ErrorEvent) {
    if (isBenign(event.message)) {
        return;
    }

    report(
        `A JavaScript error in the webapp client has occurred. (msg: ${event.message}, row: ${event.lineno}, col: ${event.colno}).`,
        event.error?.stack,
        event.filename,
    );
}

function handleUnhandledRejection(event: PromiseRejectionEvent) {
    const reason = event.reason;
    const description = reason instanceof Error ? reason.message : String(reason);

    if (isBenign(description)) {
        return;
    }

    report(
        `An unhandled promise rejection in the webapp client has occurred. (reason: ${description}).`,
        reason instanceof Error ? reason.stack : undefined,
    );
}

// Registered additively rather than via window.onerror so that a plugin or extension assigning to
// that single global slot cannot silently disable all webapp error reporting.
export function registerGlobalErrorHandlers() {
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
}
