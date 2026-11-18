// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {FAKE_SETTING, chooseProvider, expectOAuthLogin, logOut, save} from './support';

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
    const {app} = await pw.testBrowser.login(adminUser);

    // # Select Generic OpenID and fill the provider fields
    await chooseProvider(app, 'openid');
    await app.admin.setting('OpenIdSettings.ButtonText').valueTextbox.fill('TestButtonTest');

    // Select-all before fill: ColorInput keeps the leading '#' selected on focus
    const color = app.admin.setting('OpenIdSettings.ButtonColor').color.valueTextbox.locator;
    await color.click({clickCount: 3});
    await expect(color).toBeFocused();
    await color.fill('#c02222');
    await color.blur();
    await expect(color).not.toBeFocused();
    await expect(color).toHaveValue('#c02222');
    await app.admin
        .setting('OpenIdSettings.DiscoveryEndpoint')
        .valueTextbox.fill('http://test.com/.well-known/openid-configuration');
    await app.admin.setting('OpenIdSettings.Id').valueTextbox.fill('OpenIdId');
    await app.admin.setting('OpenIdSettings.Secret').valueTextbox.fill('OpenIdSecret');
    await expect(app.admin.setting('OpenIdSettings.Secret').valueTextbox).toHaveValue('OpenIdSecret');
    await save(app);

    // * Verify the saved config round-trips with a masked secret
    const config = await adminClient.getConfig();
    expect(config.OpenIdSettings.Secret).toBe(FAKE_SETTING);
    expect(config.OpenIdSettings.Id).toBe('OpenIdId');
    expect(config.OpenIdSettings.ButtonColor).toBe('#c02222');
    expect(config.OpenIdSettings.DiscoveryEndpoint).toBe('http://test.com/.well-known/openid-configuration');

    // # Log out of the System Console
    await logOut(app);

    // * Verify the login button label, href, and color
    await expectOAuthLogin(app, 'openid', 'TestButtonTest', '/oauth/openid/login', '#c02222');
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
    const {app} = await pw.testBrowser.login(adminUser);

    // # Select Google and fill the client credentials
    await chooseProvider(app, 'google');
    await app.admin.setting('GoogleSettings.Id').valueTextbox.fill('GoogleId');
    await app.admin.setting('GoogleSettings.Secret').valueTextbox.fill('GoogleSecret');
    await expect(app.admin.setting('GoogleSettings.Secret').valueTextbox).toHaveValue('GoogleSecret');
    await save(app);

    // * Verify the saved config round-trips with a masked secret
    const config = await adminClient.getConfig();
    expect(config.GoogleSettings.Secret).toBe(FAKE_SETTING);
    expect(config.GoogleSettings.Id).toBe('GoogleId');
    expect(config.GoogleSettings.DiscoveryEndpoint).toBe(
        'https://accounts.google.com/.well-known/openid-configuration',
    );

    // # Log out of the System Console
    await logOut(app);

    // * Verify the Google login button href
    await expectOAuthLogin(app, 'google', 'Google', '/oauth/google/login');
});
