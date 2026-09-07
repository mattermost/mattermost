// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Cypress ignores every uncaught browser exception (see the `uncaught:exception` handler in
 * index.js), so a component that throws in the background is invisible to a run for as long as the
 * UI it produced still satisfies the test's assertions.
 *
 * `CYPRESS_failOnPageError` turns them back into failures:
 *
 *   strict-mode  only React strict mode violations, which is what a web app built with
 *                MM_REACT_STRICT_MODE reports (webapp/channels/src/utils/react_strict_mode.ts)
 *   all          every uncaught exception, including ones from plugins and from the server being
 *                unreachable
 *   off          the default, and the behaviour the suite has always had
 *
 * This mirrors PW_FAIL_ON_PAGE_ERROR in e2e-tests/playwright/lib/src/page_error.ts.
 */

type FailureMode = 'off' | 'strict-mode' | 'all';

const STRICT_MODE_ERROR_NAME = 'ReactStrictModeViolation';
const STRICT_MODE_VIOLATION = 'React strict mode violation:';

function failureMode(): FailureMode {
    switch (Cypress.expose('failOnPageError')) {
    case 'all':
        return 'all';
    case 'strict-mode':
        return 'strict-mode';
    default:
        return 'off';
    }
}

/**
 * The web app names these errors and prefixes their message, so either is enough to recognise one.
 * Both are checked because a browser that reconstructs the error across a boundary can drop `name`.
 */
export function isStrictModeViolation(error: Error): boolean {
    return error.name === STRICT_MODE_ERROR_NAME || error.message.includes(STRICT_MODE_VIOLATION);
}

/** Whether an uncaught browser exception should fail the test that was running when it happened. */
export function shouldFailOnPageError(error: Error): boolean {
    switch (failureMode()) {
    case 'all':
        return true;
    case 'strict-mode':
        return isStrictModeViolation(error);
    default:
        return false;
    }
}
