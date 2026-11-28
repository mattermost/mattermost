// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {logInToTeam} from './support';

/**
 * @objective Verify Sign-in Method is hidden when authentication transfer is disabled.
 *
 * @precondition
 * A licensed server with OpenID enabled so a switch option would otherwise be shown.
 */
test('hides Sign-in Method when authentication transfer is disabled', {tag: '@authentication'}, async ({pw, page}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    const {adminClient, user, team} = await pw.initSetup();
    await pw.ensureSiteUrl();
    await pw.ensureKeycloakOpenId();

    // # Disable authentication transfer while another sign-in method is available
    await adminClient.patchConfig({
        ServiceSettings: {ExperimentalEnableAuthenticationTransfer: false},
    });

    // # Log in and open Profile > Security
    const app = await logInToTeam(pw, page, user.username, user.password, team);
    await app.globalHeader.openAccountMenuButton.clickTo(app.globalHeader.accountMenu.profileMenuItem);
    await app.globalHeader.accountMenu.profileMenuItem.clickTo(app.userSettingsModal);
    await app.userSettingsModal.tabs.tab('security').select();

    // * The tab is up (its Password section shows), and it offers no Sign-in Method section
    await expect(app.settings.security.section('password')).toBeVisible();
    await expect(app.settings.security.section('signin')).toHaveCount(0);
});
