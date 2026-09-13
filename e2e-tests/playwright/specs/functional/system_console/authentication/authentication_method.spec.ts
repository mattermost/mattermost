// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a basic-auth user's System Console profile shows Authentication Method Email.
 *
 * @precondition
 * A licensed server with the User Detail page available.
 */
test('shows Email as the authentication method for a basic-auth user', {tag: '@authentication'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminUser, adminClient} = await pw.initSetup();
    const user = await pw.createNewUserProfile(adminClient);
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Open the user's System Console profile
    await systemConsolePage.gotoUser(user.id);

    // * Verify the authentication method is Email
    await systemConsolePage.users.userDetail.userCard.expectAuthenticationMethod('Email');
});

/**
 * @objective Verify an MFA-enrolled basic-auth user's System Console profile shows Email, MFA.
 *
 * @precondition
 * A licensed server with MFA enabled.
 */
test('shows Email, MFA when multifactor authentication is active', {tag: '@authentication'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminUser, adminClient} = await pw.initSetup();
    const user = await pw.createNewUserProfile(adminClient);

    try {
        // # Enable MFA and enroll the user
        await adminClient.patchConfig({ServiceSettings: {EnableMultifactorAuthentication: true}});
        await pw.enableUserMfa(adminClient, user.id);

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        // # Open the user's System Console profile
        await systemConsolePage.gotoUser(user.id);

        // * Verify the authentication method includes MFA
        await systemConsolePage.users.userDetail.userCard.expectAuthenticationMethod('Email, MFA');
    } finally {
        await adminClient.patchConfig({ServiceSettings: {EnableMultifactorAuthentication: false}});
    }
});
