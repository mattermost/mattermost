// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify Multi-factor Authentication is hidden in Profile when MFA is disabled.
 *
 * @precondition
 * A licensed server with MFA available.
 */
test('hides MFA in Profile when multifactor authentication is disabled', {tag: '@authentication'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {user, adminClient} = await pw.initSetup();

    try {
        // # Disable MFA and open Profile -> Security
        await adminClient.patchConfig({
            ServiceSettings: {EnableMultifactorAuthentication: false, EnforceMultifactorAuthentication: false},
        });
        const {channelsPage} = await pw.testBrowser.login(user);
        const profileModal = await channelsPage.openProfileModal();
        await profileModal.openSecurityTab();

        // * Verify the MFA section is not shown
        await expect(profileModal.securityTab.mfaHeading).toBeHidden();
    } finally {
        await adminClient.patchConfig({
            ServiceSettings: {EnableMultifactorAuthentication: false, EnforceMultifactorAuthentication: false},
        });
    }
});

/**
 * @objective Verify Multi-factor Authentication appears in Profile when MFA is enabled.
 *
 * @precondition
 * A licensed server with MFA available.
 */
test('shows MFA in Profile when multifactor authentication is enabled', {tag: '@authentication'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {user, adminClient} = await pw.initSetup();

    try {
        // # Enable MFA and open Profile -> Security
        await adminClient.patchConfig({
            ServiceSettings: {EnableMultifactorAuthentication: true, EnforceMultifactorAuthentication: false},
        });
        const {channelsPage} = await pw.testBrowser.login(user);
        const profileModal = await channelsPage.openProfileModal();
        await profileModal.openSecurityTab();

        // * Verify the MFA section is shown
        await expect(profileModal.securityTab.mfaHeading).toBeVisible();
    } finally {
        await adminClient.patchConfig({
            ServiceSettings: {EnableMultifactorAuthentication: false, EnforceMultifactorAuthentication: false},
        });
    }
});

/**
 * @objective Verify a user can log in without an MFA prompt when MFA is enabled but not enforced.
 *
 * @precondition
 * A licensed server with MFA available.
 */
test('logs in without an MFA prompt when MFA is not enforced', {tag: '@authentication'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminClient} = await pw.initSetup();
    const user = await pw.createNewUserProfile(adminClient);

    try {
        // # Enable MFA without enforcing it
        await adminClient.patchConfig({
            ServiceSettings: {EnableMultifactorAuthentication: true, EnforceMultifactorAuthentication: false},
        });

        // # Log in as a user who has not enrolled in MFA
        await pw.hasSeenLandingPage();
        await pw.loginPage.goto();
        await pw.loginPage.toBeVisible();
        await pw.loginPage.login(user);

        // * Verify login succeeds without the MFA setup page
        await pw.mfaSetupPage.toBeHidden();
        await pw.selectTeamPage.toBeVisible();
    } finally {
        await adminClient.patchConfig({
            ServiceSettings: {EnableMultifactorAuthentication: false, EnforceMultifactorAuthentication: false},
        });
    }
});
