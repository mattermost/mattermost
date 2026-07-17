// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {duration, expect, test} from '@mattermost/playwright-lib';

import {ldapUsers, loginFromPage, setupLdap} from './support';

test.describe('LDAP filter and admin login behavior', () => {
    test.beforeEach(async ({pw}) => {
        await setupLdap(pw);
    });

    test.afterEach(async ({pw}) => {
        const {adminClient} = await pw.getAdminClient();
        await adminClient.resetOpenLdapTestState();
    });

    /**
     * @objective Verify an LDAP admin filter grants system administrator access to matching LDAP users
     *
     * @precondition
     * OpenLDAP is populated and the server has an LDAP-capable license
     */
    test('MM-T2821 LDAP Admin Filter', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient} = await pw.getAdminClient();
        await adminClient.patchConfig({LdapSettings: {EnableAdminFilter: true, AdminFilter: '(cn=dev*)'}});

        // # Log in with an LDAP account matching the admin filter
        await loginFromPage(pw, ldapUsers.admin);

        // * Verify the LDAP user can open the System Console
        await pw.loginPage.page.goto('/admin_console');
        await expect(pw.loginPage.page.getByText('System Console', {exact: true})).toBeVisible();
    });

    /**
     * @objective Verify a member excluded by the LDAP user filter cannot log in
     */
    test('Invalid login with user filter', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient} = await pw.getAdminClient();
        await adminClient.patchConfig({LdapSettings: {UserFilter: '(cn=no_users)'}});
        await expect
            .poll(async () => (await adminClient.getConfig()).LdapSettings.UserFilter, {
                timeout: duration.half_min,
            })
            .toBe('(cn=no_users)');

        // # Attempt LDAP login with a filtered member
        const response = await loginFromPage(pw, ldapUsers.member);

        // * Verify login is rejected
        expect(response.status()).toBe(401);
        await expect(pw.loginPage.loginRejectionMessage).toBeVisible({timeout: duration.half_min});
    });

    /**
     * @objective Verify a guest excluded by both LDAP filters cannot log in
     */
    test('Invalid login with guest filter', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient} = await pw.getAdminClient();
        await adminClient.patchConfig({
            LdapSettings: {UserFilter: '(cn=no_users)', GuestFilter: '(cn=no_guests)'},
        });
        await expect
            .poll(
                async () => {
                    const config = await adminClient.getConfig();
                    return [config.LdapSettings.UserFilter, config.LdapSettings.GuestFilter];
                },
                {timeout: duration.half_min},
            )
            .toEqual(['(cn=no_users)', '(cn=no_guests)']);

        // # Attempt LDAP login with a filtered guest
        const response = await loginFromPage(pw, ldapUsers.guest);

        // * Verify login is rejected
        expect(response.status()).toBe(401);
        await expect(pw.loginPage.loginRejectionMessage).toBeVisible({timeout: duration.half_min});
    });
});
