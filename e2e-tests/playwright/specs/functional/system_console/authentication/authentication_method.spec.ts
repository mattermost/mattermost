// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {App} from '@mattermost/playwright-lib';
import {expect, generated, test} from '@mattermost/playwright-lib';

/** Opens a user's System Console profile and checks its authentication method. */
async function expectAuthMethod(app: App, userId: string, method: string) {
    await app.page.goto(`${generated.AdminConsolePage.path()}/user_management/user/${userId}`);
    await expect(app.admin.user.authMethodText).toHaveText(method);
}

/**
 * @objective Verify a basic-auth user's System Console profile shows Authentication Method Email.
 *
 * @precondition
 * A licensed server with the User Detail page available.
 */
test(
    'MM-T953_1 shows Email as the authentication method for a basic-auth user',
    {tag: '@authentication'},
    async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.initSetup();
        const user = await pw.createNewUserProfile(adminClient);
        // # Log in as admin and open the user's System Console profile
        const {app} = await pw.testBrowser.login(adminUser);

        // * The user's System Console profile shows the authentication method
        await expectAuthMethod(app, user.id, 'Email');
    },
);

/**
 * @objective Verify an MFA-enrolled basic-auth user's System Console profile shows Email, MFA.
 *
 * @precondition
 * A licensed server with MFA enabled.
 */
test('MM-T953_2 shows Email, MFA when multifactor authentication is active', {tag: '@authentication'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminUser, adminClient} = await pw.initSetup();
    const user = await pw.createNewUserProfile(adminClient);

    // # Enable MFA and enroll the user
    const {restore} = await adminClient.patchConfig({ServiceSettings: {EnableMultifactorAuthentication: true}});
    try {
        await pw.enableUserMfa(adminClient, user.id);

        const {app} = await pw.testBrowser.login(adminUser);

        // * The user's System Console profile shows the authentication method
        await expectAuthMethod(app, user.id, 'Email, MFA');
    } finally {
        await restore();
    }
});
