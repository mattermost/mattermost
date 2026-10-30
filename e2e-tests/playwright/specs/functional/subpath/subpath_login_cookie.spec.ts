// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect, requireSubpathServer} from '@mattermost/playwright-lib';

test.describe('Subpath - login cookie path', {tag: '@subpath'}, () => {
    let subpathBaseURL: string;

    test.beforeAll(() => {
        subpathBaseURL = requireSubpathServer();
    });

    /**
     * @objective Verify session/CSRF cookies carry the subpath as their Path attribute.
     */
    test('cookies get the subpath as their Path attribute after login', async ({page, pw}) => {
        const {user, team} = await pw.initSetup();
        const subpath = new URL(subpathBaseURL).pathname;

        // # Suppress the "open in desktop app?" interstitial, then visit town square while logged out
        await pw.hasSeenLandingPage(subpathBaseURL);
        await page.goto(`${subpathBaseURL}/${team.name}/channels/town-square`);

        // # Log in
        await pw.loginPage.toBeVisible();
        await pw.loginPage.loginInput.fill(user.username);
        await pw.loginPage.passwordInput.fill(user.password);
        await pw.loginPage.signInButton.click();
        await expect.poll(() => page.url()).toBe(`${subpathBaseURL}/${team.name}/channels/town-square`);

        // * Verify every cookie's Path attribute is the subpath
        const cookies = await page.context().cookies();
        expect(cookies.length).toBeGreaterThan(0);
        for (const cookie of cookies) {
            expect(cookie.path).toBe(subpath);
        }
    });
});
