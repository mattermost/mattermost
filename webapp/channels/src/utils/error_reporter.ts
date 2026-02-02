// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from 'mattermost-redux/client';

// Debounce error reports to avoid flooding the server
const ERROR_REPORT_DEBOUNCE_MS = 1000;
const recentErrors = new Map<string, number>();

function shouldReportError(errorKey: string): boolean {
    const now = Date.now();
    const lastReport = recentErrors.get(errorKey);

    if (lastReport && now - lastReport < ERROR_REPORT_DEBOUNCE_MS) {
        return false;
    }

    recentErrors.set(errorKey, now);

    // Clean up old entries periodically
    if (recentErrors.size > 100) {
        const cutoff = now - ERROR_REPORT_DEBOUNCE_MS * 2;
        for (const [key, time] of recentErrors) {
            if (time < cutoff) {
                recentErrors.delete(key);
            }
        }
    }

    return true;
}

async function reportError(error: {
    type: string;
    message: string;
    stack?: string;
    url?: string;
    line?: number;
    column?: number;
    component_stack?: string;
    extra?: string;
    request_payload?: string;
    response_body?: string;
}) {
    try {
        // Create a key to deduplicate errors
        const errorKey = `${error.type}:${error.message}:${error.stack?.slice(0, 200) || ''}`;

        if (!shouldReportError(errorKey)) {
            return;
        }

        await Client4.reportError(error);
    } catch (e) {
        // Silently fail - don't want error reporting to cause errors
        console.warn('Failed to report error:', e);
    }
}

export function initErrorReporter() {
    // Global error handler for uncaught errors
    window.addEventListener('error', (event) => {
        // Ignore errors from extensions or external scripts
        if (event.filename && !event.filename.includes(window.location.origin)) {
            return;
        }

        reportError({
            type: 'js',
            message: event.message || 'Unknown error',
            stack: event.error?.stack || '',
            url: event.filename || window.location.href,
            line: event.lineno,
            column: event.colno,
        });
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason;
        let message = 'Unhandled promise rejection';
        let stack = '';

        if (reason instanceof Error) {
            message = reason.message || message;
            stack = reason.stack || '';
        } else if (typeof reason === 'string') {
            message = reason;
        } else if (reason && typeof reason === 'object') {
            message = reason.message || JSON.stringify(reason);
        }

        reportError({
            type: 'js',
            message,
            stack,
            url: window.location.href,
        });
    });

    // Override console.error to capture logged errors
    const originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
        originalConsoleError.apply(console, args);

        // Build message from arguments
        const message = args.map((arg) => {
            if (arg instanceof Error) {
                return arg.message;
            }
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg);
                } catch {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');

        // Only report if it looks like a real error (not just logging)
        if (message.toLowerCase().includes('error') || args.some((arg) => arg instanceof Error)) {
            const error = args.find((arg) => arg instanceof Error) as Error | undefined;
            reportError({
                type: 'js',
                message: message.slice(0, 1000), // Limit length
                stack: error?.stack || new Error().stack || '',
                url: window.location.href,
            });
        }
    };
}

// Export for manual error reporting (e.g., from React Error Boundaries)
export function reportReactError(error: Error, componentStack: string) {
    reportError({
        type: 'js',
        message: error.message,
        stack: error.stack || '',
        url: window.location.href,
        component_stack: componentStack,
    });
}

export function reportAPIError(
    endpoint: string,
    method: string,
    statusCode: number,
    message: string,
    requestPayload?: unknown,
    responseBody?: unknown,
) {
    // Safely stringify payloads, limiting size
    let requestPayloadStr = '';
    let responseBodyStr = '';

    try {
        if (requestPayload !== undefined) {
            requestPayloadStr = typeof requestPayload === 'string' ?
                requestPayload.slice(0, 5000) :
                JSON.stringify(requestPayload, null, 2).slice(0, 5000);
        }
    } catch {
        requestPayloadStr = '[Unable to serialize request payload]';
    }

    try {
        if (responseBody !== undefined) {
            responseBodyStr = typeof responseBody === 'string' ?
                responseBody.slice(0, 5000) :
                JSON.stringify(responseBody, null, 2).slice(0, 5000);
        }
    } catch {
        responseBodyStr = '[Unable to serialize response body]';
    }

    reportError({
        type: 'api',
        message,
        url: endpoint,
        extra: JSON.stringify({
            method,
            status_code: statusCode,
        }),
        request_payload: requestPayloadStr,
        response_body: responseBodyStr,
    });
}
