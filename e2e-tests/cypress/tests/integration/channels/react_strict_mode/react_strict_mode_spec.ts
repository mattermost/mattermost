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
 * identical runs. Cypress ignored uncaught exceptions outright until recently, which is exactly the
 * kind of silence this test is here to prevent coming back.
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

/** How React reports a findDOMNode call under StrictMode: a format string, its arguments, then the
 * component stack. */
const REACT_WARNING_ARGS = [
    'Warning: %s is deprecated in StrictMode. %s was passed an instance of %s which is inside StrictMode.%s',
    'findDOMNode',
    'findDOMNode',
    'Transition',
    '\n    in Transition (created by CSSTransition)\n    in CSSTransition (created by MenuWrapperAnimation)',
];

const EXPECTED_MESSAGE =
    'React strict mode violation: Warning: findDOMNode is deprecated in StrictMode. ' +
    'findDOMNode was passed an instance of Transition which is inside StrictMode.';

describe('React strict mode detection', () => {
    before(() => {
        cy.apiInitSetup({loginAfter: true}).then(({team}) => {
            cy.visit(`/${team.name}/channels/town-square`);
        });
    });

    it('reports a strict mode violation as an uncaught exception', function() {
        // The diagnostics are only installed in a build made with MM_REACT_STRICT_MODE, which is not
        // how the web app ships. There is nothing to detect in any other build.
        cy.window().then((win) => {
            const installed = Array.isArray((win as {reactStrictModeViolations?: StrictModeViolation[]}).reactStrictModeViolations);
            if (!installed) {
                cy.log('Web app was not built with MM_REACT_STRICT_MODE, skipping');
                this.skip();
            }
        });

        // # Collect the violation instead of letting it fail this test, which is what the global
        // handler in tests/support/index.js would otherwise do
        const uncaught: Error[] = [];
        cy.on('uncaught:exception', (error) => {
            uncaught.push(error);
            return false;
        });

        // # Report a warning the way React's development runtime does
        cy.window().then((win) => {
            (win.console.error as (...args: unknown[]) => void)(...REACT_WARNING_ARGS);
        });

        // * The warning should be rethrown as an uncaught exception. It is rethrown from a queued
        // task, so this has to be retried rather than asserted once.
        cy.wrap(null).should(() => {
            expect(uncaught.map((error) => error.name)).to.include('ReactStrictModeViolation');
        });

        cy.wrap(null).then(() => {
            const violation = uncaught.find((error) => error.name === 'ReactStrictModeViolation')!;

            // * The message should be the warning React would have printed, with its arguments
            // substituted and the component stack split off
            expect(violation.message).to.equal(EXPECTED_MESSAGE);

            // * The stack should name the components responsible, not just the warning
            expect(violation.stack).to.contain('in Transition (created by CSSTransition)');
            expect(violation.stack).to.contain('in CSSTransition (created by MenuWrapperAnimation)');

            // * The harness should classify it as something to fail on
            expect(isStrictModeViolation(violation)).to.equal(true);
        });

        // * The app should record it for anyone reading the page afterwards
        cy.window().then((win) => {
            const recorded = (win as {reactStrictModeViolations?: StrictModeViolation[]}).reactStrictModeViolations ?? [];
            const match = recorded.find((entry) => entry.componentStack?.includes('in Transition (created by CSSTransition)'));

            expect(match, 'violation recorded on window.reactStrictModeViolations').to.not.equal(undefined);
        });
    });
});
