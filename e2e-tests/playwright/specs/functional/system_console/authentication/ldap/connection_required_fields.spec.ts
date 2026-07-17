// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {SystemConsolePage, expect, test} from '@mattermost/playwright-lib';

import {setupLdap} from './support';

test.describe('LDAP connection and required-field validation', () => {
    test.beforeEach(async ({pw}) => {
        await setupLdap(pw);
    });

    test.afterEach(async ({pw}) => {
        const {adminClient} = await pw.getAdminClient();
        await adminClient.configureOpenLdap();
    });

    /**
     * @objective Verify the LDAP connection test reports success
     */
    test('MM-T2699 Connection test button - Successful', {tag: '@ldap'}, async ({pw}) => {
        const {adminUser} = await pw.getAdminClient();
        const {page} = await pw.testBrowser.login(adminUser!);
        const consolePage = new SystemConsolePage(page);
        await consolePage.ldap.goto();

        // # Test the configured LDAP connection
        await page.getByRole('button', {name: /test connection/i}).click();

        // * Verify a successful result
        await expect(page.getByText(/test connection successful/i)).toBeVisible();
        await expect(page.getByTitle(/success icon/i)).toBeVisible();
    });

    /**
     * @objective Verify Username Attribute is required in LDAP settings
     */
    test('MM-T2700 LDAP username required', {tag: '@ldap'}, async ({pw}) => {
        const {adminUser} = await pw.getAdminClient();
        const {page} = await pw.testBrowser.login(adminUser!);
        const consolePage = new SystemConsolePage(page);
        await consolePage.ldap.goto();

        // # Clear Username Attribute and save
        await page.getByLabel(/username attribute:/i).fill('');
        await page.getByRole('button', {name: 'Save', exact: true}).click();

        // * Verify required-field validation
        await expect(page.getByText('AD/LDAP field "Username Attribute" is required.')).toBeVisible();

        // # Restore the configured value
        await page.getByLabel(/username attribute:/i).fill('uid');
        await page.getByRole('button', {name: 'Save', exact: true}).click();
    });

    /**
     * @objective Verify Login ID Attribute is required in LDAP settings
     */
    test('MM-T2701 LDAP LoginidAttribute required', {tag: '@ldap'}, async ({pw}) => {
        const {adminUser} = await pw.getAdminClient();
        const {page} = await pw.testBrowser.login(adminUser!);
        const consolePage = new SystemConsolePage(page);
        await consolePage.ldap.goto();

        // # Clear Login ID Attribute and save
        await page.getByTestId('LdapSettings.LoginIdAttributeinput').fill('');
        await page.getByRole('button', {name: 'Save', exact: true}).click();

        // * Verify required-field validation
        await expect(page.getByText(/ad\/ldap field "login id attribute" is required./i)).toBeVisible();
    });
});
