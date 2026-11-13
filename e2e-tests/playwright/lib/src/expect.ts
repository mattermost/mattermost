// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect as baseExpect} from '@playwright/test';
import type {Locator, Page} from '@playwright/test';

import {testConfig} from './test_config';

/**
 * Playwright's expect, extended with matchers that are aware of the server subpath.
 */
export const expect = baseExpect.extend({
    /**
     * Asserts the page is at the given app path, e.g. `/team/channels/town-square`. Pass the path as the
     * app sees it: the subpath prefix is added when the suite runs against a subpath deployment.
     *
     * Use this instead of toHaveURL('/path'), which Playwright resolves against baseURL and so drops
     * the subpath. Only the pathname is compared; origin, query and hash are ignored.
     */
    async toHavePath(page: Page, path: string, options?: {timeout?: number}) {
        const expected = testConfig.withSubpath(path);
        const assertionName = 'toHavePath';
        try {
            await baseExpect(page).toHaveURL((url) => url.pathname === expected, options);
            return {
                pass: true,
                name: assertionName,
                message: () => `Expected page not to be at path ${expected}`,
            };
        } catch {
            let received: string;
            try {
                received = new URL(page.url()).pathname;
            } catch {
                received = page.url();
            }
            return {
                pass: false,
                name: assertionName,
                expected,
                actual: received,
                message: () => `Expected page path: ${expected}\nReceived page path: ${received}`,
            };
        }
    },

    /**
     * Asserts the element's href points at the given app path, e.g. `/admin_console/site_config`. Pass
     * the path as the app sees it: the subpath prefix is added when the suite runs against a subpath
     * deployment. A relative href is resolved against the page URL, and only the pathname is compared.
     */
    async toHaveHrefPath(locator: Locator, path: string, options?: {timeout?: number}) {
        const expected = testConfig.withSubpath(path);
        const assertionName = 'toHaveHrefPath';
        const pageUrl = () => locator.page().url();
        const pathnameOf = (href: string | null) => (href === null ? null : new URL(href, pageUrl()).pathname);

        try {
            await baseExpect
                .poll(async () => pathnameOf(await locator.getAttribute('href', options)), options)
                .toBe(expected);
            return {
                pass: true,
                name: assertionName,
                message: () => `Expected href not to point at path ${expected}`,
            };
        } catch {
            let received: string | null = null;
            try {
                received = pathnameOf(await locator.getAttribute('href', {timeout: 1000}));
            } catch {
                // The element is gone or has no href, so there is nothing to report.
            }
            return {
                pass: false,
                name: assertionName,
                expected,
                actual: received,
                message: () => `Expected href path: ${expected}\nReceived href path: ${received}`,
            };
        }
    },
});
