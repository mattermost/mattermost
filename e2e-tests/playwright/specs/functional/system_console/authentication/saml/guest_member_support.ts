// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import {
    ChannelsPage,
    configureSamlWithKeycloak,
    KeycloakAdminClient,
    KeycloakLoginPage,
    LoginPage,
    testConfig,
} from '@mattermost/playwright-lib';
import type {KeycloakUser, PlaywrightExtended} from '@mattermost/playwright-lib';

export const guestAttributeName = 'mattermostGuest';

export async function configureGuestSaml(
    pw: PlaywrightExtended,
    options: {enableGuestAccess: boolean; guestAttribute: string},
) {
    const {adminClient, adminUser} = await pw.getAdminClient();
    const keycloak = new KeycloakAdminClient();
    const idpCertificate = await keycloak.configureSamlClient(testConfig.baseURL, [guestAttributeName]);
    await configureSamlWithKeycloak(adminClient, {
        baseURL: testConfig.baseURL,
        enableSyncWithLdap: false,
        enableGuestAccess: options.enableGuestAccess,
        guestAttribute: options.guestAttribute,
        enableAdminAttribute: false,
        adminAttribute: '',
        idpCertificate,
    });
    return {adminClient, adminUser, keycloak};
}

export async function setupSamlUser(
    pw: PlaywrightExtended,
    page: Page,
    options: {enableGuestAccess: boolean; guestAttribute: string},
) {
    const {adminClient, keycloak} = await configureGuestSaml(pw, options);
    const id = pw.random.id();
    const user: KeycloakUser = {
        username: `saml-${id}`,
        password: 'Password1!',
        email: `saml-${id}@mmtest.com`,
        firstName: 'SAML',
        lastName: 'Guest',
        attributes: {[guestAttributeName]: ['true']},
    };
    await keycloak.createUser(user);

    // # Register the user through the visible Mattermost and Keycloak SAML login flow
    await loginWithSaml(page, user);

    // # Assign the registered account to a team and its default public channel
    const mattermostUser = await adminClient.getUserByEmail(user.email);
    const team = await adminClient.createTeam(await pw.random.team());
    await adminClient.addToTeam(team.id, mattermostUser.id);
    const townSquare = await adminClient.getChannelByName(team.id, 'town-square');
    await adminClient.addToChannel(mattermostUser.id, townSquare.id);
    await page.goto('about:blank');
    await page.context().clearCookies();
    await adminClient.revokeAllSessionsForUser(mattermostUser.id);

    // # Log in through SAML again and open the assigned channel
    await loginWithSaml(page, user);
    const channelsPage = new ChannelsPage(page);
    await channelsPage.goto(team.name, townSquare.name);
    await channelsPage.toBeVisible();
    return {adminClient, channelsPage, user};
}

async function loginWithSaml(page: Page, user: KeycloakUser) {
    await page.goto('about:blank');
    await page.context().clearCookies();
    const loginPage = new LoginPage(page);
    const keycloakLoginPage = new KeycloakLoginPage(page);
    await loginPage.goto();
    await loginPage.loginWithSaml();
    await keycloakLoginPage.submit(user);
}
