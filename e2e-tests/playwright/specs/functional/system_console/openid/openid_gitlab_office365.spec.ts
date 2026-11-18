// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {FAKE_SETTING, chooseProvider, expectOAuthLogin, logOut, save} from './support';

/**
 * @objective Verify saving GitLab OpenID Connect settings in the System Console
 * persists the client id, derives the discovery URL from the site URL, masks the
 * secret, and shows a GitLab login button.
 *
 * @precondition
 * A licensed server with the OpenID Connect System Console page available.
 */
test('MM-T3621 saves GitLab OpenID Connect settings and shows the login button', {tag: '@openid'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminUser, adminClient} = await pw.initSetup();
    const {app} = await pw.testBrowser.login(adminUser);

    // # Select GitLab and fill the site URL and client credentials
    await chooseProvider(app, 'gitlab');
    await app.admin.setting('GitLabSettings.Url').valueTextbox.fill('https://gitlab.com');
    await app.admin.setting('GitLabSettings.Id').valueTextbox.fill('GitlabId');
    await app.admin.setting('GitLabSettings.Secret').valueTextbox.fill('GitlabSecret');
    await expect(app.admin.setting('GitLabSettings.Secret').valueTextbox).toHaveValue('GitlabSecret');
    await save(app);

    // * Verify the saved config round-trips with a masked secret
    const config = await adminClient.getConfig();
    expect(config.GitLabSettings.Secret).toBe(FAKE_SETTING);
    expect(config.GitLabSettings.Id).toBe('GitlabId');
    expect(config.GitLabSettings.DiscoveryEndpoint).toBe('https://gitlab.com/.well-known/openid-configuration');

    // # Log out of the System Console
    await logOut(app);

    // * Verify the GitLab login button href
    await expectOAuthLogin(app, 'gitlab', 'GitLab', '/oauth/gitlab/login');
});

/**
 * @objective Verify saving Entra ID OpenID Connect settings in the System Console
 * persists the client id, derives the discovery URL from the tenant id, masks
 * the secret, and shows an Entra ID login button.
 *
 * @precondition
 * A licensed server with the OpenID Connect System Console page available.
 */
test('MM-T3622 saves Entra ID OpenID Connect settings and shows the login button', {tag: '@openid'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminUser, adminClient} = await pw.initSetup();
    const {app} = await pw.testBrowser.login(adminUser);

    // # Select Entra ID and fill the tenant id and client credentials
    await chooseProvider(app, 'office365');
    await app.admin.setting('Office365Settings.DirectoryId').valueTextbox.fill('common');
    await app.admin.setting('Office365Settings.Id').valueTextbox.fill('Office365Id');
    await app.admin.setting('Office365Settings.Secret').valueTextbox.fill('Office365Secret');
    await expect(app.admin.setting('Office365Settings.Secret').valueTextbox).toHaveValue('Office365Secret');
    await save(app);

    // * Verify the saved config round-trips with a masked secret
    const config = await adminClient.getConfig();
    expect(config.Office365Settings.Secret).toBe(FAKE_SETTING);
    expect(config.Office365Settings.Id).toBe('Office365Id');
    expect(config.Office365Settings.DiscoveryEndpoint).toBe(
        'https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration',
    );

    // # Log out of the System Console
    await logOut(app);

    // * Verify the Entra ID login button href
    await expectOAuthLogin(app, 'office365', 'Entra ID', '/oauth/office365/login');
});
