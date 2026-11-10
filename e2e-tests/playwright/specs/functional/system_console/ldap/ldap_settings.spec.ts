// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify the AD/LDAP Test Connection button succeeds against the configured directory.
 *
 * @precondition
 * An LDAP directory reachable at the configured LdapSettings.LdapServer/LdapPort.
 */
test('MM-T2699 AD/LDAP test connection succeeds against the configured directory', {tag: '@ldap'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    const {adminUser} = await pw.initSetup();
    await pw.ensureOpenldap();
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Open AD/LDAP settings and test the connection
    await systemConsolePage.gotoAdLdap();
    await systemConsolePage.adLdap.testConnectionButton.click();

    // * Verify the connection succeeds
    await expect(systemConsolePage.adLdap.testConnectionSuccess).toBeVisible();
    await expect(systemConsolePage.adLdap.successIcon).toBeVisible();
});

/**
 * @objective Verify saving AD/LDAP settings without a Username Attribute is blocked.
 *
 * @precondition
 * An LDAP directory reachable at the configured LdapSettings.LdapServer/LdapPort.
 */
test('MM-T2700 requires Username Attribute before saving AD/LDAP settings', {tag: '@ldap'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    const {adminUser} = await pw.initSetup();
    await pw.ensureOpenldap();
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Clear Username Attribute and save
    await systemConsolePage.gotoAdLdap();
    await systemConsolePage.adLdap.usernameAttribute.clear();
    await systemConsolePage.adLdap.save();

    // * Verify the required-field error is shown
    await expect(systemConsolePage.adLdap.usernameAttributeRequiredError).toBeVisible();

    // # Restore Username Attribute and save
    await systemConsolePage.adLdap.usernameAttribute.fill('uid');
    await systemConsolePage.adLdap.save();
    await systemConsolePage.adLdap.expectSaveComplete();
});

/**
 * @objective Verify saving AD/LDAP settings without a Login ID Attribute is blocked.
 *
 * @precondition
 * An LDAP directory reachable at the configured LdapSettings.LdapServer/LdapPort.
 */
test('MM-T2701 requires Login ID Attribute before saving AD/LDAP settings', {tag: '@ldap'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    const {adminUser} = await pw.initSetup();
    await pw.ensureOpenldap();
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Clear Login ID Attribute and save
    await systemConsolePage.gotoAdLdap();
    await systemConsolePage.adLdap.loginIdAttribute.clear();
    await systemConsolePage.adLdap.save();

    // * Verify the required-field error is shown
    await expect(systemConsolePage.adLdap.loginIdAttributeRequiredError).toBeVisible();
});
