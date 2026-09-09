// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @react_strict_mode

import {isStrictModeViolation} from '../../../support/page_error';

/**
 * Verifies that a React strict mode violation in the web app reaches the run as an uncaught
 * exception, which is what CYPRESS_failOnPageError fails on.
 *
 * Every other spec covers this only by accident: it reports a violation when the app happens to have
 * one, and says nothing when it doesn't, so "the app is clean" and "detection is broken" produce
 * identical runs. Cypress ignored uncaught exceptions outright until recently, which is the kind of
 * silence this test exists to stop coming back.
 *
 * The warning is injected through console.error rather than caused by a real component. React only
 * emits these from its own internals, so the alternative is keeping a deliberately broken component
 * in the app, and the coverage would disappear the moment someone fixed it. Everything downstream of
 * console.error is the real thing.
 */

type StrictModeViolation = {
    message: string;
    componentStack?: string;
};

// Unique component names keep retries from being swallowed by the per-page deduplication.
function reactWarningArgs(component: string) {
    return [
        'Cannot update a component (`%s`) while rendering a different component (`%s`).%s',
        'ChannelView',
        component,
        `\n    at ${component} (post_list.tsx:20)\n    at ChannelView`,
    ];
}

describe('React strict mode detection', () => {
    // The diagnostics are only installed in a build made with MM_REACT_STRICT_MODE, which is not how
    // the web app ships. Decided here rather than in the test body because this.skip() only takes
    // effect synchronously, and reading it before the app has rendered would read it as absent.
    let diagnosticsInstalled = false;

    before(() => {
        cy.apiInitSetup({loginAfter: true}).then(({team}) => {
            cy.visit(`/${team.name}/channels/town-square`);
        });

        cy.uiGetPostTextBox().should('be.visible');

        cy.window().then((win) => {
            diagnosticsInstalled = Array.isArray(
                (win as {reactStrictModeViolations?: StrictModeViolation[]}).reactStrictModeViolations,
            );
            if (Cypress.expose('failOnPageError') === 'strict-mode') {
                expect(diagnosticsInstalled, 'StrictMode discovery requires an instrumented web app').to.equal(true);
            }
        });
    });

    it('reports a strict mode violation as an uncaught exception', function() {
        if (!diagnosticsInstalled) {
            cy.log('Web app was not built with MM_REACT_STRICT_MODE, skipping');
            this.skip();
        }

        const component = `PostList${Date.now()}`;
        const expectedMessage =
            `React strict mode violation: Cannot update a component (\`ChannelView\`) while rendering a different component (\`${component}\`).`;

        // # Collect the violation instead of letting it fail this test, which is what the global
        // handler in tests/support/index.js would otherwise do
        const uncaught: Error[] = [];
        cy.on('uncaught:exception', (error) => {
            uncaught.push(error);
            return false;
        });

        // # Report a warning the way React's development runtime does
        cy.window().then((win) => {
            (win.console.error as (...args: unknown[]) => void)(...reactWarningArgs(component));
        });

        // * The warning should be rethrown as an uncaught exception. It is rethrown from a queued
        // task, so this has to be retried rather than asserted once.
        cy.wrap(null).should(() => {
            expect(uncaught.map((error) => error.name)).to.include('ReactStrictModeViolation');
        });

        cy.wrap(null).then(() => {
            const violation = uncaught.find((error) => error.name === 'ReactStrictModeViolation')!;

            // * The reported error should carry the warning React would have printed, with its
            // arguments substituted and the component stack split off. Cypress wraps the message in
            // its own "originated from your application code" text, hence contain rather than equal.
            expect(violation.message).to.contain(expectedMessage);

            // * The stack should name the components responsible, not just the warning
            expect(violation.stack).to.contain(`at ${component} (post_list.tsx:20)`);
            expect(violation.stack).to.contain('at ChannelView');

            // * The harness should classify it as something to fail on
            expect(isStrictModeViolation(violation)).to.equal(true);
        });

        // * The app should record it for anyone reading the page afterwards
        cy.window().then((win) => {
            const recorded = (win as {reactStrictModeViolations?: StrictModeViolation[]}).reactStrictModeViolations ?? [];
            const match = recorded.find((entry) => entry.componentStack?.includes(`at ${component} (post_list.tsx:20)`));

            expect(match, 'violation recorded on window.reactStrictModeViolations').to.not.equal(undefined);
        });
    });
});
