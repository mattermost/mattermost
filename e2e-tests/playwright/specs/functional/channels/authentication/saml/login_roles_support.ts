// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import {
    ChannelsPage,
    configureSamlWithKeycloak,
    expect,
    KeycloakAdminClient,
    KeycloakLoginPage,
    testConfig,
} from '@mattermost/playwright-lib';
import type {KeycloakUser, PlaywrightExtended} from '@mattermost/playwright-lib';

export type RoleOptions = {
    attributeName?: 'UserType' | 'IsGuest' | 'IsAdmin';
    attributeValue?: string;
    guestAttribute?: string;
    adminAttribute?: string;
    expectedRole: 'member' | 'guest' | 'admin';
};

export async function verifyNewAndExistingLogin(pw: PlaywrightExtended, page: Page, options: RoleOptions) {
    const {adminClient} = await pw.getAdminClient();
    const keycloak = new KeycloakAdminClient();
    const mapperNames = options.attributeName ? [options.attributeName] : [];
    const idpCertificate = await keycloak.configureSamlClient(testConfig.baseURL, mapperNames);
    await configureSamlWithKeycloak(adminClient, {
        baseURL: testConfig.baseURL,
        enableSyncWithLdap: false,
        enableGuestAccess: true,
        guestAttribute: options.guestAttribute || '',
        enableAdminAttribute: Boolean(options.adminAttribute),
        adminAttribute: options.adminAttribute || '',
        idpCertificate,
    });
    const user = createKeycloakUser(pw, options);
    await keycloak.createUser(user);
    const keycloakLoginPage = new KeycloakLoginPage(page);

    // # Log in as a new Keycloak user through the visible SAML flow
    await keycloakLoginPage.login(user);

    // * Verify Mattermost creates the user with the mapped role
    const mattermostUser = await adminClient.getUserByEmail(user.email);
    expectRole(mattermostUser.roles, options.expectedRole);

    // # Give the new account a team and channel, remove its registration session, then log in through SAML again
    const team = await adminClient.createTeam(await pw.random.team());
    await adminClient.addToTeam(team.id, mattermostUser.id);
    const townSquare = await adminClient.getChannelByName(team.id, 'town-square');
    await adminClient.addToChannel(mattermostUser.id, townSquare.id);
    await page.goto('about:blank');
    await page.context().clearCookies();
    await adminClient.revokeAllSessionsForUser(mattermostUser.id);
    await keycloakLoginPage.login(user);
    const channelsPage = new ChannelsPage(page);
    await channelsPage.goto(team.name, townSquare.name);
    await channelsPage.toBeVisible();

    // * Verify the existing Mattermost account and mapped role are reused
    const existingUser = await adminClient.getUserByEmail(user.email);
    expect(existingUser.id).toBe(mattermostUser.id);
    expectRole(existingUser.roles, options.expectedRole);
}

function createKeycloakUser(pw: PlaywrightExtended, options: RoleOptions): KeycloakUser {
    const id = pw.random.id();
    return {
        username: `saml-role-${id}`,
        password: 'Password1!',
        email: `saml-role-${id}@mmtest.com`,
        firstName: 'SAML',
        lastName: 'Role',
        attributes:
            options.attributeName && options.attributeValue
                ? {[options.attributeName]: [options.attributeValue]}
                : undefined,
    };
}

function expectRole(roles: string, expectedRole: RoleOptions['expectedRole']) {
    if (expectedRole === 'guest') {
        expect(roles).toContain('system_guest');
        return;
    }
    if (expectedRole === 'admin') {
        expect(roles).toContain('system_admin');
        return;
    }
    expect(roles).not.toContain('system_guest');
    expect(roles).not.toContain('system_admin');
}
