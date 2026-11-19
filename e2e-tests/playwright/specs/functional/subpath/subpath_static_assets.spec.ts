// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect, requireSubpathServer} from '@mattermost/playwright-lib';

test.describe('Subpath - static assets', {tag: '@subpath'}, () => {
    let subpathBaseURL: string;

    test.beforeAll(() => {
        subpathBaseURL = requireSubpathServer();
    });

    /**
     * @objective Verify static asset URLs in the root document are rewritten to include the subpath.
     */
    test('rewrites the root document static asset references to include the subpath', async ({page}) => {
        const subpath = new URL(subpathBaseURL).pathname;

        // # Load the root document
        const response = await page.goto(subpathBaseURL);
        expect(response?.ok()).toBeTruthy();

        // * Verify its static asset references include the subpath
        const html = await page.content();
        expect(html).toContain(`${subpath}/static/`);
    });
});
