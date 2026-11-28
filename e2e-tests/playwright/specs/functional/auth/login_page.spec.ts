// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {openLogin} from './support';

/**
 * @objective Verify empty login fields show validation errors instead of submitting.
 */
test('shows validation errors for empty login fields', {tag: '@authentication'}, async ({pw, page}) => {
    const app = await openLogin(pw, page);

    // # Submit the login form with both fields empty
    await app.login.card.logInButton.click();

    // * Verify empty-field errors are shown and the user stays on login
    await expect(app.login.banner).toBeVisible();
    await expect(app.login.banner).toContainText(/Please enter your /);
    await expect(page).toHavePath(app.loginPage.pathFor());
});

/**
 * @objective Verify the create-account link is hidden when open server is disabled.
 */
test(
    'MM-T1760 hides the create-account link when open server is disabled',
    {tag: '@authentication'},
    async ({pw, page}) => {
        const {adminClient} = await pw.getAdminClient();

        // # Disable open server
        await adminClient.patchConfig({TeamSettings: {EnableOpenServer: false}});

        const app = await openLogin(pw, page);

        // * Verify the create-account link is hidden
        await expect(app.login.alternate.actionLink).toBeHidden();
    },
);
