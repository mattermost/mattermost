// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// React only runs its StrictMode checks in a development build of react-dom, and it reports every
// violation by calling console.error. Both halves of that are a problem when we want to find code
// that misbehaves under concurrent rendering in a build that behaves like the one we ship: the
// checks have to be compiled in, and a console message is too easy to lose in a CI log.
//
// This module is only pulled in when the REACT_STRICT_MODE build flag is set (see webpack.config.js,
// which also swaps in React's development runtime). It intercepts the warnings React writes to
// console.error and rethrows the ones that indicate a concurrency hazard as real exceptions, so they
// surface to window.onerror and to Playwright's `pageerror` event.

/* eslint-disable no-console */

export type StrictModeViolation = {
    message: string;
    componentStack?: string;
};

declare global {
    interface Window {

        /** Every distinct violation seen so far, in the order they were reported. */
        reactStrictModeViolations?: StrictModeViolation[];

        /**
         * Throw from inside console.error rather than rethrowing out of band. This aborts the
         * render that triggered the warning, so the app usually dies on the first violation and
         * hides the rest. Useful when debugging a single violation by hand.
         */
        reactStrictModeThrowSynchronously?: boolean;
    }
}

/**
 * React warnings that mean the code being warned about is unsafe under concurrent rendering: it
 * either uses an API StrictMode has deprecated, or it has a side effect ordering bug that double
 * invoking render and effects has exposed.
 */
const CONCURRENCY_HAZARDS = [

    // StrictMode-only deprecation warnings
    /has been found within a strict mode tree/,
    /is deprecated in StrictMode/,
    /in strict mode is not recommended/,
    /uses the legacy (childContextTypes|contextTypes) API/,
    /Legacy context API has been detected within a strict-mode tree/,

    // Render purity and effect ordering
    /Cannot update a component \(.+\) while rendering a different component/,
    /Cannot update during an existing state transition/,
    /Can't perform a React state update on an unmounted component/,
    /Maximum update depth exceeded/,
    /flushSync was called from inside a lifecycle method/,

    // External store subscriptions, which react-redux and useSyncExternalStore rely on
    /The result of getSnapshot should be cached to avoid an infinite loop/,
    /The result of getServerSnapshot should be cached/,
    /Detected multiple renderers concurrently rendering the same context provider/,

    // Hook ordering, which only breaks once a render is interrupted and restarted
    /React has detected a change in the order of Hooks/,
    /Rendered (more|fewer) hooks than during the previous render/,
    /Should have a queue\. This is likely a bug in React/,

    // Suspense under a synchronous update
    /A component suspended while responding to synchronous input/,
];

/** Warnings React only emits from the test renderer, which can never fire in the browser anyway. */
const IGNORED = [
    /inside a test was not wrapped in act/,
];

/**
 * Rebuild the string React would have printed. React always calls console.error with a printf
 * style format string followed by string arguments, the last of which is the component stack.
 */
function formatWarning(args: unknown[]): string {
    const [format, ...rest] = args;

    if (typeof format !== 'string') {
        return args.map(String).join(' ');
    }

    let index = 0;
    const substituted = format.replace(/%[sdifoOc]/g, (match) => {
        if (index >= rest.length) {
            return match;
        }
        return String(rest[index++]);
    });

    return [substituted, ...rest.slice(index).map(String)].join(' ');
}

/**
 * React appends the component stack as the last argument, prefixed by a newline. Splitting it off
 * keeps the exception message short enough to read in a test report while preserving the stack.
 */
function splitComponentStack(message: string): StrictModeViolation {
    const stackStart = message.search(/\n\s+(in|at) \S/);

    if (stackStart === -1) {
        return {message};
    }

    return {
        message: message.slice(0, stackStart).trim(),
        componentStack: message.slice(stackStart).trim(),
    };
}

export function installReactStrictModeDiagnostics() {
    const violations: StrictModeViolation[] = [];
    const reported = new Set<string>();

    window.reactStrictModeViolations = violations;

    const originalConsoleError = console.error;

    console.error = (...args: unknown[]) => {
        originalConsoleError.apply(console, args);

        const formatted = formatWarning(args);

        if (IGNORED.some((pattern) => pattern.test(formatted))) {
            return;
        }

        if (!CONCURRENCY_HAZARDS.some((pattern) => pattern.test(formatted))) {
            return;
        }

        const violation = splitComponentStack(formatted);

        // React repeats most warnings once per offending component instance. Reporting each
        // distinct message once keeps a single bad component from burying every other violation.
        if (reported.has(violation.message)) {
            return;
        }
        reported.add(violation.message);
        violations.push(violation);

        const error = new Error(`React strict mode violation: ${violation.message}`);
        error.name = 'ReactStrictModeViolation';
        if (violation.componentStack) {
            // Appended rather than assigned. An Error whose stack holds no recognisable frames
            // reaches Playwright's pageerror event as an empty string, which drops the component
            // stack exactly when there is one worth reading.
            error.stack = `${error.stack}\n${violation.componentStack}`;
        }

        if (window.reactStrictModeThrowSynchronously) {
            throw error;
        }

        // Rethrowing from a fresh task still produces an uncaught exception, but it does so after
        // React has finished the work that emitted the warning. That keeps the app alive so a
        // single run reports every violation instead of only the first one.
        setTimeout(() => {
            throw error;
        }, 0);
    };
}
