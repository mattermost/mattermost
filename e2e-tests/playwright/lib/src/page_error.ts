// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

/**
 * Uncaught exceptions in the browser normally go unnoticed by a Playwright run: a test only fails
 * if a locator times out or an assertion fails, so a component that throws in the background looks
 * fine as long as the UI it produced is still usable.
 *
 * When PW_FAIL_ON_PAGE_ERROR is set, every page opened by the harness is watched for uncaught
 * exceptions and the test fails at teardown with the exceptions it saw. This is what makes the web
 * app's React strict mode diagnostics (webapp/channels/src/utils/react_strict_mode.ts) visible in
 * CI, since those are reported as uncaught exceptions.
 */

export type PageError = {
    message: string;
    stack?: string;
};

let collected: PageError[] = [];

export function shouldFailOnPageError(): boolean {
    return process.env.PW_FAIL_ON_PAGE_ERROR === 'true';
}

export function resetPageErrors(): void {
    collected = [];
}

export function watchForPageErrors(page: Page): void {
    if (!shouldFailOnPageError()) {
        return;
    }

    page.on('pageerror', (error) => {
        collected.push({message: error.message, stack: error.stack});
    });
}

export function getPageErrors(): PageError[] {
    return collected;
}

export function formatPageErrors(errors: PageError[]): string {
    const details = errors.map((error, index) => `${index + 1}. ${error.stack ?? error.message}`).join('\n\n');

    return `${errors.length} uncaught browser exception(s) during this test:\n\n${details}`;
}

/** Throws if any watched page reported an uncaught exception. Call after the test body has run. */
export function assertNoPageErrors(): void {
    if (!shouldFailOnPageError() || collected.length === 0) {
        return;
    }

    const errors = collected;
    resetPageErrors();

    throw new Error(formatPageErrors(errors));
}
