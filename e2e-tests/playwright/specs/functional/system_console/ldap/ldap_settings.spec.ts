// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {openSystemConsoleSection, Api, expect, Msg, settle, test, type App} from '@mattermost/playwright-lib';

/** Opens System Console > AD/LDAP, once its Test Connection button shows. */
async function openAdLdap(app: App) {
    await openSystemConsoleSection(app, 'authentication/ldap');
    await expect(app.admin.setting('LdapSettings.TestConnection').requestButton).toBeVisible();
}

/**
 * @objective Verify AD/LDAP Test Connection succeeds against the configured directory.
 *
 * @precondition
 * A licensed server with OpenLDAP.
 */
test('MM-T2699 AD/LDAP test connection succeeds against the configured directory', {tag: '@ldap'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminUser} = await pw.initSetup();
    await pw.ensureOpenldap();

    const {app} = await pw.testBrowser.login(adminUser);
    await openAdLdap(app);

    // # Test the connection
    const testConnection = app.admin.setting('LdapSettings.TestConnection');
    await testConnection.requestButton.click();

    // * Verify the connection test succeeds
    await expect(testConnection.requestSuccessText).toHaveMessage(Msg.admin.ldap.testConnectionSuccess);
});

/**
 * @objective Verify AD/LDAP settings can't be saved without a Username Attribute.
 *
 * @precondition
 * A licensed server with OpenLDAP.
 */
test('MM-T2700 requires Username Attribute before saving AD/LDAP settings', {tag: '@ldap'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminUser} = await pw.initSetup();
    await pw.ensureOpenldap();

    const {app} = await pw.testBrowser.login(adminUser);
    await openAdLdap(app);
    const usernameAttribute = app.admin.setting('LdapSettings.UsernameAttribute').valueTextbox;

    // # Clear Username Attribute and save
    await usernameAttribute.clear();
    await settle(app.admin.saveButton, {wait: Api.PatchConfig, status: 400}).click();

    // * Verify the save is refused
    await expect(app.admin.ldapWizard.saveError).toContainText('AD/LDAP field "Username Attribute" is required.');

    // # Set it again and save
    await usernameAttribute.fill('uid');
    await settle(app.admin.saveButton, {wait: Api.PatchConfig}).click();

    // * Verify the save completes
    await expect(app.admin.saveButton).toBeSaved();
});

/**
 * @objective Verify AD/LDAP settings can't be saved without a Login ID Attribute.
 *
 * @precondition
 * A licensed server with OpenLDAP.
 */
test('MM-T2701 requires Login ID Attribute before saving AD/LDAP settings', {tag: '@ldap'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminUser} = await pw.initSetup();
    await pw.ensureOpenldap();

    const {app} = await pw.testBrowser.login(adminUser);
    await openAdLdap(app);

    // # Clear Login ID Attribute and save
    await app.admin.setting('LdapSettings.LoginIdAttribute').valueTextbox.clear();
    await settle(app.admin.saveButton, {wait: Api.PatchConfig, status: 400}).click();

    // * Verify the save is refused
    await expect(app.admin.ldapWizard.saveError).toContainText('AD/LDAP field "Login ID Attribute" is required.');
});
