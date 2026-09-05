// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    expect,
    formatPageErrors,
    getPageErrors,
    resetPageErrors,
    shouldFailOnPageError,
    test,
} from '@mattermost/playwright-lib';

type StrictModeViolation = {
    message: string;
    componentStack?: string;
};

type StrictModeWindow = Window & {
    reactStrictModeViolations?: StrictModeViolation[];
};

/**
 * How React reports a findDOMNode call under StrictMode: a printf-style format string, its
 * arguments, and the component stack last.
 */
const REACT_WARNING_ARGS = [
    'Warning: %s is deprecated in StrictMode. %s was passed an instance of %s which is inside StrictMode.%s',
    'findDOMNode',
    'findDOMNode',
    'Transition',
    '\n    in Transition (created by CSSTransition)\n    in CSSTransition (created by MenuWrapperAnimation)',
];

// The violation this test provokes would otherwise fail it during fixture teardown.
test.afterEach(() => {
    resetPageErrors();
});

/**
 * @objective Verify that a React strict mode violation in the web app reaches the E2E run as an
 * uncaught browser exception, so PW_FAIL_ON_PAGE_ERROR has something real to fail on.
 *
 * Every other spec covers this only by accident: it reports a violation when the app happens to have
 * one, and says nothing when it doesn't. That makes "the app is clean" and "detection is broken"
 * produce identical runs, which is exactly the guesswork this test removes.
 *
 * The warning is injected through console.error rather than caused by a real component. React only
 * emits these from its own internals, so the alternative is keeping a deliberately broken component
 * in the app, and the coverage would disappear the moment someone fixed it. Everything downstream of
 * console.error is the real thing: the pattern matching, the printf-style formatting, the component
 * stack split, the rethrow, and the harness that collects it.
 */
test(
    'a React strict mode violation surfaces as an uncaught browser exception',
    {tag: '@react_strict_mode'},
    async ({pw}) => {
        const {user} = await pw.initSetup();
        const {page, channelsPage} = await pw.testBrowser.login(user);

        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // The diagnostics are only installed in a build made with MM_REACT_STRICT_MODE, which is not
        // how the web app ships. There is nothing to detect in any other build.
        const diagnosticsInstalled = await page.evaluate(() =>
            Array.isArray((window as StrictModeWindow).reactStrictModeViolations),
        );
        test.skip(!diagnosticsInstalled, 'Web app was not built with MM_REACT_STRICT_MODE');

        // # Watch for uncaught exceptions directly, so this holds whether or not the run enables
        // PW_FAIL_ON_PAGE_ERROR
        const uncaught: Error[] = [];
        page.on('pageerror', (error) => uncaught.push(error));

        // # Report a warning the way React's development runtime does
        await page.evaluate((args) => {
            // eslint-disable-next-line no-console
            console.error(...args);
        }, REACT_WARNING_ARGS);

        // * The warning should be rethrown as an uncaught exception
        await expect.poll(() => uncaught.map((error) => error.name)).toContain('ReactStrictModeViolation');

        const violation = uncaught.find((error) => error.name === 'ReactStrictModeViolation')!;

        // * The message should be the warning React would have printed, with its arguments
        // substituted and the component stack split off
        expect(violation.message).toBe(
            'React strict mode violation: Warning: findDOMNode is deprecated in StrictMode. ' +
                'findDOMNode was passed an instance of Transition which is inside StrictMode.',
        );

        // * The stack should name the components responsible, not just the warning. Playwright
        // rebuilds this error from the browser and drops any stack it cannot read frames from, so
        // this also pins down that the component stack is appended to a real one rather than
        // replacing it.
        expect(violation.stack).toContain('in Transition (created by CSSTransition)');
        expect(violation.stack).toContain('in CSSTransition (created by MenuWrapperAnimation)');

        // * The app should record it for anyone reading the page afterwards
        const recorded = await page.evaluate(() => (window as StrictModeWindow).reactStrictModeViolations ?? []);
        expect(recorded).toContainEqual(
            expect.objectContaining({
                componentStack: expect.stringContaining('in Transition (created by CSSTransition)'),
            }),
        );

        // * A run configured to fail on these should have collected it, and the report it would
        // fail with should be readable rather than an empty line
        if (shouldFailOnPageError()) {
            const collected = getPageErrors();
            expect(collected.map((error) => error.message)).toContain(violation.message);
            expect(formatPageErrors(collected)).toContain('in CSSTransition (created by MenuWrapperAnimation)');
        }
    },
);
