// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

const FAKE_SETTING = '********************************';

/**
 * @objective Verify saving GitLab OpenID Connect settings in the System Console
 * persists the client id, derives the discovery URL from the site URL, masks
 * the secret, and shows a GitLab login button.
 *
 * @precondition
 * A licensed server with the OpenID Connect System Console page available.
 */
test('saves GitLab OpenID Connect settings and shows the login button', {tag: '@openid'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminUser, adminClient} = await pw.initSetup();
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    try {
        // # Open the OpenID Connect settings page
        await systemConsolePage.gotoOpenIdConnect();

        // # Select GitLab and fill the site URL and client credentials
        await systemConsolePage.openIdConnect.selectProvider('gitlab');
        await systemConsolePage.openIdConnect.gitlabSiteUrl.fill('https://gitlab.com');
        await systemConsolePage.openIdConnect.clientId.fill('GitlabId');
        await systemConsolePage.openIdConnect.clientSecret.fill('GitlabSecret');
        await systemConsolePage.openIdConnect.save();

        // * Verify the saved config round-trips with a masked secret
        const config = await adminClient.getConfig();
        expect(config.GitLabSettings.Secret).toBe(FAKE_SETTING);
        expect(config.GitLabSettings.Id).toBe('GitlabId');
        expect(config.GitLabSettings.DiscoveryEndpoint).toBe('https://gitlab.com/.well-known/openid-configuration');

        // # Log out of the System Console
        await systemConsolePage.logOut();

        // * Verify the GitLab login button href
        await systemConsolePage.loginPage.expectOAuthLogin('GitLab', '/oauth/gitlab/login');
    } finally {
        await adminClient.patchConfig({
            OpenIdSettings: {Enable: false},
            GoogleSettings: {Enable: false},
            GitLabSettings: {Enable: false},
            Office365Settings: {Enable: false},
        });
    }
});

/**
 * @objective Verify saving Entra ID OpenID Connect settings in the System Console
 * persists the client id, derives the discovery URL from the tenant id, masks
 * the secret, and shows an Entra ID login button.
 *
 * @precondition
 * A licensed server with the OpenID Connect System Console page available.
 */
test('saves Entra ID OpenID Connect settings and shows the login button', {tag: '@openid'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminUser, adminClient} = await pw.initSetup();
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    try {
        // # Open the OpenID Connect settings page
        await systemConsolePage.gotoOpenIdConnect();

        // # Select Entra ID and fill the tenant id and client credentials
        await systemConsolePage.openIdConnect.selectProvider('office365');
        await systemConsolePage.openIdConnect.directoryId.fill('common');
        await systemConsolePage.openIdConnect.clientId.fill('Office365Id');
        await systemConsolePage.openIdConnect.clientSecret.fill('Office365Secret');
        await systemConsolePage.openIdConnect.save();

        // * Verify the saved config round-trips with a masked secret
        const config = await adminClient.getConfig();
        expect(config.Office365Settings.Secret).toBe(FAKE_SETTING);
        expect(config.Office365Settings.Id).toBe('Office365Id');
        expect(config.Office365Settings.DiscoveryEndpoint).toBe(
            'https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration',
        );

        // # Log out of the System Console
        await systemConsolePage.logOut();

        // * Verify the Entra ID login button href
        await systemConsolePage.loginPage.expectOAuthLogin('Entra ID', '/oauth/office365/login');
    } finally {
        await adminClient.patchConfig({
            OpenIdSettings: {Enable: false},
            GoogleSettings: {Enable: false},
            GitLabSettings: {Enable: false},
            Office365Settings: {Enable: false},
        });
    }
});
