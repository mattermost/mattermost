// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

/**
 * @objective Verify an unenrolled user is sent to MFA setup when MFA is enabled and enforced.
 *
 * @precondition
 * A licensed server with MFA available.
 */
test('sends an unenrolled user to MFA setup when MFA is enforced', {tag: '@authentication'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminUser, adminClient} = await pw.initSetup();
    const user = await pw.createNewUserProfile(adminClient);
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    try {
        // # Enable and enforce MFA in the System Console
        await systemConsolePage.gotoMfaSettings();
        await systemConsolePage.mfaSettings.enableTrue.check();
        await systemConsolePage.mfaSettings.enforceTrue.check();
        await systemConsolePage.mfaSettings.save();

        // # Log in as a user who has not enrolled in MFA
        await pw.hasSeenLandingPage();
        await pw.loginPage.goto();
        await pw.loginPage.toBeVisible();
        await pw.loginPage.submitCredentials(user.username, user.password);

        // * Verify the MFA setup page is shown
        await pw.mfaSetupPage.toBeVisible();
    } finally {
        await adminClient.patchConfig({
            ServiceSettings: {EnableMultifactorAuthentication: false, EnforceMultifactorAuthentication: false},
        });
    }
});

/**
 * @objective Verify a system admin can remove MFA from a user who has enrolled.
 *
 * @precondition
 * A licensed server with MFA available.
 */
test('lets an admin remove MFA from an enrolled user', {tag: '@authentication'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminUser, adminClient} = await pw.initSetup();
    const user = await pw.createNewUserProfile(adminClient);

    try {
        // # Enable MFA and enroll the user
        await adminClient.patchConfig({
            ServiceSettings: {EnableMultifactorAuthentication: true, EnforceMultifactorAuthentication: false},
        });
        await pw.enableUserMfa(adminClient, user.id);

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        // # Open the user's action menu and remove MFA
        await systemConsolePage.gotoUsers();
        const actions = await systemConsolePage.users.openUserActions(user.username);
        await actions.clickRemoveMfa();

        // # Log in as that user after MFA is removed
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

/**
 * @objective Verify Remove MFA is hidden for a user who has not enrolled in MFA.
 *
 * @precondition
 * A licensed server with MFA available.
 */
test('hides Remove MFA for a user who has not enrolled', {tag: '@authentication'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminUser, adminClient} = await pw.initSetup();
    const user = await pw.createNewUserProfile(adminClient);

    try {
        // # Enable MFA without enrolling the user
        await adminClient.patchConfig({
            ServiceSettings: {EnableMultifactorAuthentication: true, EnforceMultifactorAuthentication: false},
        });

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        // # Open the user's action menu
        await systemConsolePage.gotoUsers();
        const actions = await systemConsolePage.users.openUserActions(user.username);

        // * Verify Remove MFA is not offered
        await actions.expectRemoveMfaHidden();
    } finally {
        await adminClient.patchConfig({
            ServiceSettings: {EnableMultifactorAuthentication: false, EnforceMultifactorAuthentication: false},
        });
    }
});
