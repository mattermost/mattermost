// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify Sign-in Method is hidden when authentication transfer is disabled.
 *
 * @precondition
 * A licensed server with OpenID enabled so a switch option would otherwise be shown.
 */
test('hides Sign-in Method when authentication transfer is disabled', {tag: '@authentication'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    await pw.ensureKeycloakOpenId();
    await pw.ensureSiteUrl();

    const {adminClient, user, team} = await pw.initSetup();

    try {
        // # Disable authentication transfer while another sign-in method is available
        await adminClient.patchConfig({
            ServiceSettings: {ExperimentalEnableAuthenticationTransfer: false},
        });

        // # Log in and open Profile -> Security
        await pw.hasSeenLandingPage();
        await pw.loginPage.goto();
        await pw.loginPage.toBeVisible();
        await pw.loginPage.login(user);
        await pw.channelsPage.goto(team.name);
        await pw.channelsPage.toBeVisible();

        const profileModal = await pw.channelsPage.openProfileModal();
        await profileModal.openSecurityTab();

        // * Verify the Sign-in Method section is not offered
        await expect(profileModal.securityTab.signInHeading).toBeHidden();
        await expect(profileModal.securityTab.editSignInMethod).toBeHidden();
    } finally {
        await adminClient.patchConfig({
            OpenIdSettings: {Enable: false},
            ServiceSettings: {ExperimentalEnableAuthenticationTransfer: true},
        });
    }
});
