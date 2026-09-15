// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, getAdminClient, test} from '@mattermost/playwright-lib';

const FAKE_SETTING = '********************************';

// Each test enables SSO on the shared server via the System Console; the OpenID Connect
// section's save disables the other providers as a side effect, but nothing resets them
// after the last test in this file, so later specs in the run could inherit a stray login
// button. Reset once after all tests, pass or fail.
test.afterAll(async () => {
    const {adminClient} = await getAdminClient();
    await adminClient.patchConfig({
        OpenIdSettings: {Enable: false},
        GoogleSettings: {Enable: false},
    });
});

/**
 * @objective Verify saving Generic OpenID Connect settings in the System Console
 * persists the client id and discovery URL, masks the secret, and shows a
 * matching login button.
 *
 * @precondition
 * A licensed server with the OpenID Connect System Console page available.
 */
test('MM-T3623 saves Generic OpenID Connect settings and shows the login button', {tag: '@openid'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminUser, adminClient} = await pw.initSetup();
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Open the OpenID Connect settings page
    await systemConsolePage.gotoOpenIdConnect();

    // # Select Generic OpenID and fill the provider fields
    await systemConsolePage.openIdConnect.selectProvider('openid');
    await systemConsolePage.openIdConnect.buttonName.fill('TestButtonTest');
    await systemConsolePage.openIdConnect.fillButtonColor('#c02222');
    await systemConsolePage.openIdConnect.discoveryEndpoint.fill('http://test.com/.well-known/openid-configuration');
    await systemConsolePage.openIdConnect.clientId.fill('OpenIdId');
    await systemConsolePage.openIdConnect.clientSecret.fill('OpenIdSecret');
    await systemConsolePage.openIdConnect.save();

    // * Verify the saved config round-trips with a masked secret
    const config = await adminClient.getConfig();
    expect(config.OpenIdSettings.Secret).toBe(FAKE_SETTING);
    expect(config.OpenIdSettings.Id).toBe('OpenIdId');
    expect(config.OpenIdSettings.ButtonColor).toBe('#c02222');
    expect(config.OpenIdSettings.DiscoveryEndpoint).toBe('http://test.com/.well-known/openid-configuration');

    // # Log out of the System Console
    await systemConsolePage.logOut();

    // * Verify the login button label, href, and color
    await systemConsolePage.loginPage.expectOAuthLogin('TestButtonTest', '/oauth/openid/login', '#c02222');
});

/**
 * @objective Verify saving Google OpenID Connect settings in the System Console
 * persists the client id, uses Google's discovery URL, masks the secret, and
 * shows a Google login button.
 *
 * @precondition
 * A licensed server with the OpenID Connect System Console page available.
 */
test('MM-T3620 saves Google OpenID Connect settings and shows the login button', {tag: '@openid'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminUser, adminClient} = await pw.initSetup();
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Open the OpenID Connect settings page
    await systemConsolePage.gotoOpenIdConnect();

    // # Select Google and fill the client credentials
    await systemConsolePage.openIdConnect.selectProvider('google');
    await systemConsolePage.openIdConnect.clientId.fill('GoogleId');
    await systemConsolePage.openIdConnect.clientSecret.fill('GoogleSecret');
    await systemConsolePage.openIdConnect.save();

    // * Verify the saved config round-trips with a masked secret
    const config = await adminClient.getConfig();
    expect(config.GoogleSettings.Secret).toBe(FAKE_SETTING);
    expect(config.GoogleSettings.Id).toBe('GoogleId');
    expect(config.GoogleSettings.DiscoveryEndpoint).toBe(
        'https://accounts.google.com/.well-known/openid-configuration',
    );

    // # Log out of the System Console
    await systemConsolePage.logOut();

    // * Verify the Google login button href
    await systemConsolePage.loginPage.expectOAuthLogin('Google', '/oauth/google/login');
});
