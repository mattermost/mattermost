// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that the pdfjs cmaps path fix in webpack.config.js works.
 *
 * Context: PR #35810 changed the copy-webpack-plugin entry for pdfjs cmaps from
 * a fragile relative path to one resolved via require.resolve():
 *
 *   Before: {from: '../node_modules/pdfjs-dist/cmaps', to: 'cmaps'}
 *   After:  {from: path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'cmaps'), to: 'cmaps'}
 *
 * The old path broke with npm workspace hoisting — pdfjs-dist gets installed at
 * the root node_modules, not channels/node_modules, so the relative path resolves
 * to nothing and copy-webpack-plugin silently copies zero files.
 *
 * A 404 on identity-h means the cmaps directory was not copied to /static/cmaps/.
 */

test('pdfjs cmaps are copied to /static/cmaps/ and served correctly', {tag: '@pdf_preview'}, async ({pw}) => {
    const {user} = await pw.initSetup();
    const {page} = await pw.testBrowser.login(user);

    const baseUrl = new URL(page.url()).origin;

    // # identity-h is a standard CMap that pdfjs requests for non-Latin PDFs.
    // Its presence confirms copy-webpack-plugin found and copied the cmaps directory.
    const cmapUrl = `${baseUrl}/static/cmaps/identity-h`;
    const response = await page.request.get(cmapUrl);

    // * 200 = require.resolve() found the right path and cmaps were copied.
    // * 404 = the path in webpack.config.js is wrong or copy-webpack-plugin skipped it.
    expect(
        response.status(),
        `CMap not found at ${cmapUrl} — pdfjs cmaps were not copied to /static/cmaps/. ` +
            'Check the copy-webpack-plugin entry in webpack.config.js.',
    ).toBe(200);

    const body = await response.body();
    expect(body.length, 'identity-h CMap file must not be empty').toBeGreaterThan(0);
});
