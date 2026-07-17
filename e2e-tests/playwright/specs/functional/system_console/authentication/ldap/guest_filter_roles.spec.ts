// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {SystemConsolePage, expect, test} from '@mattermost/playwright-lib';

import {getLdapUser, ldapUsers, loginFromPage, removeFromAllTeams, setupLdap} from './support';

test.describe('LDAP authentication and guest filters', () => {
    test.describe.configure({mode: 'serial'});

    test.beforeEach(async ({pw}) => {
        await setupLdap(pw);
    });

    /**
     * @objective Verify the LDAP guest filter demotes matching users and preserves their guest role when cleared
     */
    test('MM-T1422 LDAP Guest Filter', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient, adminUser} = await pw.getAdminClient();
        await adminClient.patchConfig({GuestAccountsSettings: {Enable: true}});
        const userOne = await getLdapUser(adminClient, ldapUsers.guestFilterOne);
        const userTwo = await getLdapUser(adminClient, ldapUsers.guestFilterTwo);
        await adminClient.promoteGuestToUser(userOne.id).catch(() => undefined);
        await adminClient.promoteGuestToUser(userTwo.id).catch(() => undefined);
        await removeFromAllTeams(adminClient, userOne);
        await removeFromAllTeams(adminClient, userTwo);
        const {page} = await pw.testBrowser.login(adminUser!);
        const consolePage = new SystemConsolePage(page);

        // # Set the LDAP guest filter to the first user and synchronize
        await consolePage.ldap.goto();
        await consolePage.ldap.expandAdditionalFilters();
        await consolePage.ldap.setGuestFilter(`(uid=${ldapUsers.guestFilterOne.username})`);
        await adminClient.runLdapSync();
        await pw.makeClient(ldapUsers.guestFilterOne, {useCache: false});

        // * Verify only the matching account becomes a guest
        expect((await adminClient.getUser(userOne.id)).roles).toContain('system_guest');
        expect((await adminClient.getUser(userTwo.id)).roles).not.toContain('system_guest');

        // # Clear the guest filter and synchronize again
        await consolePage.ldap.setGuestFilter('');
        await adminClient.runLdapSync();

        // * Verify the existing guest remains a guest
        expect((await adminClient.getUser(userOne.id)).roles).toContain('system_guest');
    });

    /**
     * @objective Verify manually demoting an LDAP member persists after the user logs in again
     */
    test('MM-T1425 LDAP Guest Filter Change', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient} = await pw.getAdminClient();
        await adminClient.patchConfig({GuestAccountsSettings: {Enable: true}, LdapSettings: {GuestFilter: ''}});
        const user = await getLdapUser(adminClient, ldapUsers.guestFilterTwo);
        await adminClient.demoteUserToGuest(user.id);

        // # Log in again after demotion
        await loginFromPage(pw, ldapUsers.guestFilterTwo);

        // * Verify the account remains a guest
        expect((await adminClient.getUser(user.id)).roles).toContain('system_guest');
    });
});
