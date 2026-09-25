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

// Rejections carry an arbitrary value, so recover a message from error-like objects and fall back to
// JSON rather than letting String() flatten them to "[object Object]".
function describeReason(reason: unknown) {
    if (reason instanceof Error) {
        return reason.message;
    }

    if (typeof reason === 'object' && reason !== null) {
        try {
            const serialized = JSON.stringify(reason);
            if (serialized && serialized !== '{}') {
                return serialized;
            }
        } catch {
            // Circular or otherwise unserializable, so fall through.
        }

        const {message} = reason as {message?: unknown};
        if (typeof message === 'string') {
            return message;
        }
    }

    return String(reason);
}

function handleUnhandledRejection(event: PromiseRejectionEvent) {
    const reason = event.reason;
    const description = describeReason(reason);

    if (isBenign(description)) {
        return;
    }

    report(
        `An unhandled promise rejection in the webapp client has occurred. (reason: ${description}).`,
        reason instanceof Error ? reason.stack : undefined,
    );
}

export function registerGlobalErrorHandlers() {
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
}
