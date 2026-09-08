// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Captures React development warnings emitted via console.error / console.warn (such as those from
// StrictMode) during E2E runs, and logs them to the Cypress command log, the terminal, and a log
// file for later collection. This only produces output when the web app is served from a development
// build; production builds strip these warnings. See MM-70393.

type CapturedWarning = {
    method: 'error' | 'warn';
    test: string;
    message: string;
};

const capturedWarnings: CapturedWarning[] = [];
let currentTestTitle = '';

// React logs warnings using printf-style substitutions, e.g. console.error('Warning: %s', name), so
// reconstruct a readable message from the raw console arguments.
function formatConsoleArgs(args: unknown[]): string {
    if (!args.length) {
        return '';
    }

    const stringify = (value: unknown) => (typeof value === 'string' ? value : String(value));

    const [first, ...rest] = args;

    if (typeof first === 'string' && first.includes('%')) {
        let index = 0;
        const formatted = first.replace(/%[sdoic]/g, (match) => {
            if (index >= rest.length) {
                return match;
            }

            return stringify(rest[index++]);
        });

        return [formatted, ...rest.slice(index).map(stringify)].join(' ');
    }

    return args.map(stringify).join(' ');
}

Cypress.on('window:before:load', (win) => {
    (['error', 'warn'] as const).forEach((method) => {
        const original = win.console[method] as ((...args: unknown[]) => void) & {mmWrapped?: boolean};

        // Avoid double-wrapping when the window object is reused (testIsolation is disabled).
        if (original.mmWrapped) {
            return;
        }

        const wrapped = function wrapped(this: unknown, ...args: unknown[]) {
            try {
                capturedWarnings.push({
                    method,
                    test: currentTestTitle,
                    message: formatConsoleArgs(args),
                });
            } catch {
                // Never let capturing break the test.
            }

            return original.apply(this, args);
        } as typeof original;

        wrapped.mmWrapped = true;
        win.console[method] = wrapped;
    });
});

beforeEach(function trackCurrentTest(this: Mocha.Context) {
    currentTestTitle = this.currentTest?.fullTitle() ?? '';
});

afterEach(() => {
    if (!capturedWarnings.length) {
        return;
    }

    // Drain the buffer so warnings aren't double-reported in a later test.
    const warnings = capturedWarnings.splice(0, capturedWarnings.length);

    // Surface in the Cypress command log (visible in the runner and recorded video)...
    cy.log(`Captured ${warnings.length} React warning(s)`);

    // ...in the terminal / CI output...
    warnings.forEach((warning) => {
        cy.task('log', `[react:${warning.method}] ${warning.test} :: ${warning.message}`);
    });

    // ...and append to a log file for later collection.
    cy.task('appendReactWarnings', {spec: Cypress.spec.relative, warnings});
});
