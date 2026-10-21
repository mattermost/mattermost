// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify Multi-factor Authentication is hidden in Profile when MFA is disabled.
 *
 * @precondition
 * A licensed server with MFA available.
 */
test(
    'MM-T1777 hides MFA in Profile when multifactor authentication is disabled',
    {tag: '@authentication'},
    async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();

        const {user, team} = await pw.initSetup();

        // # Open Profile -> Security
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name);
        await channelsPage.toBeVisible();
        const profileModal = await channelsPage.openProfileModal();
        await profileModal.openSecurityTab();

        // * Verify the MFA section is not shown
        await expect(profileModal.securityTab.mfaHeading).toBeHidden();
    },
);

/**
 * @objective Verify Multi-factor Authentication appears in Profile when MFA is enabled.
 *
 * @precondition
 * A licensed server with MFA available.
 */
test(
    'MM-T1779 shows MFA in Profile when multifactor authentication is enabled',
    {tag: '@authentication'},
    async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();

        const {user, adminClient, team} = await pw.initSetup();

        // # Enable MFA and open Profile -> Security
        const {restore} = await adminClient.patchConfig({
            ServiceSettings: {EnableMultifactorAuthentication: true, EnforceMultifactorAuthentication: false},
        });
        try {
            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name);
            await channelsPage.toBeVisible();
            const profileModal = await channelsPage.openProfileModal();
            await profileModal.openSecurityTab();

            // * Verify the MFA section is shown
            await expect(profileModal.securityTab.mfaHeading).toBeVisible();
        } finally {
            await restore();
        }
    },
);

/**
 * @objective Verify a user can log in without an MFA prompt when MFA is enabled but not enforced.
 *
 * @precondition
 * A licensed server with MFA available.
 */
test('MM-T1780 logs in without an MFA prompt when MFA is not enforced', {tag: '@authentication'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminClient} = await pw.initSetup();
    const user = await pw.createNewUserProfile(adminClient);

    // # Enable MFA without enforcing it
    const {restore} = await adminClient.patchConfig({
        ServiceSettings: {EnableMultifactorAuthentication: true, EnforceMultifactorAuthentication: false},
    });
    try {
        // # Log in as a user who has not enrolled in MFA
        await pw.hasSeenLandingPage();
        await pw.loginPage.goto();
        await pw.loginPage.toBeVisible();
        await pw.loginPage.login(user);

        // * Verify login succeeds without the MFA setup page
        await pw.mfaSetupPage.toBeHidden();
        await pw.selectTeamPage.toBeVisible();
    } finally {
        await restore();
    }
});
