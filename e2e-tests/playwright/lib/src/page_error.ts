// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

/**
 * Uncaught exceptions in the browser normally go unnoticed by a Playwright run: a test only fails
 * if a locator times out or an assertion fails, so a component that throws in the background looks
 * fine as long as the UI it produced is still usable.
 *
 * PW_FAIL_ON_PAGE_ERROR makes those exceptions fail the test at teardown:
 *
 *   strict-mode  only React strict mode violations, which is what a web app built with
 *                MM_REACT_STRICT_MODE reports (webapp/channels/src/utils/react_strict_mode.ts)
 *   all          every uncaught exception, including ones from plugins and from the server being
 *                unreachable
 *   unset        off
 */

export type PageError = {
    message: string;
    stack?: string;
};

type FailureMode = 'off' | 'strict-mode' | 'all';

const STRICT_MODE_VIOLATION = 'React strict mode violation:';

let collected: PageError[] = [];

function failureMode(): FailureMode {
    switch (process.env.PW_FAIL_ON_PAGE_ERROR) {
        case 'all':
            return 'all';
        case 'strict-mode':
            return 'strict-mode';
        default:
            return 'off';
    }
}

export function shouldFailOnPageError(): boolean {
    return failureMode() !== 'off';
}

export function resetPageErrors(): void {
    collected = [];
}

export function watchForPageErrors(page: Page): void {
    const mode = failureMode();

    if (mode === 'off') {
        return;
    }

    page.on('pageerror', (error) => {
        if (mode === 'strict-mode' && !error.message.includes(STRICT_MODE_VIOLATION)) {
            return;
        }

        collected.push({message: error.message, stack: error.stack});
    });
}

export function getPageErrors(): PageError[] {
    return collected;
}

export function formatPageErrors(errors: PageError[]): string {
    // `||` rather than `??`: Playwright reports an empty stack for errors it could not read frames
    // from, and an empty entry here would say nothing at all.
    const details = errors.map((error, index) => `${index + 1}. ${error.stack || error.message}`).join('\n\n');

    return `${errors.length} uncaught browser exception(s) during this test:\n\n${details}`;
}

/** Throws if any watched page reported an uncaught exception. Call after the test body has run. */
export function assertNoPageErrors(): void {
    if (collected.length === 0) {
        return;
    }

    const errors = collected;
    resetPageErrors();

    throw new Error(formatPageErrors(errors));
}
