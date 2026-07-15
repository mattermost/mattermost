// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import {
    ChannelsPage,
    configureSamlWithKeycloak,
    duration,
    expect,
    KeycloakAdminClient,
    KeycloakLoginPage,
    LoginPage,
    OpenLdapClient,
    testConfig,
} from '@mattermost/playwright-lib';
import type {KeycloakUser, LdapUser, PlaywrightClient4, PlaywrightExtended} from '@mattermost/playwright-lib';

export type SamlUserSetup = {
    adminClient: PlaywrightClient4;
    keycloak: KeycloakAdminClient;
    ldap: OpenLdapClient;
    ldapUser: LdapUser;
    samlUser: KeycloakUser;
    channelsPage: ChannelsPage;
    keycloakLoginPage: KeycloakLoginPage;
    loginPage: LoginPage;
};

export async function setupSamlUser(
    pw: PlaywrightExtended,
    page: Page,
    options: {enableSyncWithLdap: boolean; createInLdap?: boolean},
): Promise<SamlUserSetup> {
    const {adminClient} = await pw.getAdminClient();
    const ldap = new OpenLdapClient();
    const keycloak = new KeycloakAdminClient();
    const ldapUser = createOpenLdapUser(pw);
    const samlUser = {
        username: ldapUser.username,
        password: ldapUser.password,
        email: ldapUser.email,
        firstName: `SamlFirst-${pw.random.id()}`,
        lastName: `SamlLast-${pw.random.id()}`,
    };
    const channelsPage = new ChannelsPage(page);
    const keycloakLoginPage = new KeycloakLoginPage(page);
    const loginPage = new LoginPage(page);

    await pw.hasSeenLandingPage();
    const idpCertificate = await keycloak.configureSamlClient(testConfig.baseURL);
    await configureSamlWithKeycloak(adminClient, {
        baseURL: testConfig.baseURL,
        enableSyncWithLdap: options.enableSyncWithLdap,
        enableGuestAccess: true,
        guestAttribute: '',
        enableAdminAttribute: false,
        adminAttribute: '',
        idpCertificate,
    });
    if (options.createInLdap !== false) {
        await ldap.createUser(ldapUser);
    }
    await keycloak.createUser(samlUser);
    await keycloakLoginPage.login(samlUser);

    if (options.createInLdap !== false) {
        await addUserToNewTeam(pw, adminClient, ldapUser.email);
        const mattermostUser = await adminClient.getUserByEmail(ldapUser.email);
        await page.goto('about:blank');
        await page.context().clearCookies();
        await adminClient.revokeAllSessionsForUser(mattermostUser.id);
        await keycloakLoginPage.login(samlUser);
        await channelsPage.toBeVisible();
    }

    return {adminClient, channelsPage, keycloak, keycloakLoginPage, ldap, ldapUser, loginPage, samlUser};
}

export async function assertFullName(channelsPage: ChannelsPage, firstName: string, lastName: string) {
    const profileModal = await channelsPage.openProfileModal();
    await expect(profileModal.container.getByText(`${firstName} ${lastName}`, {exact: true})).toBeVisible({
        timeout: duration.half_min,
    });
    await profileModal.closeModal();
}

export async function addUserToNewTeam(pw: PlaywrightExtended, adminClient: PlaywrightClient4, email: string) {
    const user = await adminClient.getUserByEmail(email);
    const team = await adminClient.createTeam(await pw.random.team());
    await adminClient.addToTeam(team.id, user.id);
}

function createOpenLdapUser(pw: PlaywrightExtended): LdapUser {
    const id = pw.random.id();
    const username = `samluser${id}`;
    return {
        username,
        password: 'Password1',
        email: `${username}@mmtest.com`,
        firstName: `Firstname-${id}`,
        lastName: `Lastname-${id}`,
    };
}
