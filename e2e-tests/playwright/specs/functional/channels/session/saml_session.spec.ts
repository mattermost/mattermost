// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import type {UserProfile} from '@mattermost/types/users';

import {
    ChannelsPage,
    configureSamlWithKeycloak,
    duration,
    expect,
    KeycloakAdminClient,
    KeycloakLoginPage,
    OpenLdapClient,
    test,
    testConfig,
} from '@mattermost/playwright-lib';
import type {LdapUser, PlaywrightExtended} from '@mattermost/playwright-lib';

import {getActiveSessions, getSession, updateSessionExpiration} from './session_db';

const sessionLengthInDays = 1;

test.describe('SAML session extension', () => {
    test.beforeEach(async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();
    });

    /**
     * @objective Verify SAML user activity extends a near-expiry session when activity-based extension is enabled
     *
     * @precondition
     * OpenLDAP, Keycloak, and PostgreSQL are directly reachable, and the server has an enterprise license
     */
    test(
        'MM-T4047_1 SAML/SSO user session should have extended due to user activity when enabled',
        {tag: '@saml'},
        async ({pw, page}) => {
            const {adminClient, channelsPage, samlUser} = await setup(pw, page, true);
            const [initialSession] = await getActiveSessions(samlUser.id);
            expect(initialSession).toBeTruthy();
            const nearExpiry = Date.now() + duration.ten_sec;
            const updated = await updateSessionExpiration(initialSession.id, nearExpiry);
            expect(Number(updated.expiresat)).toBe(nearExpiry);
            await adminClient.invalidateCaches();

            // # Generate user activity after making the SAML session expire soon
            await channelsPage.postMessage(`extend ${Date.now()}`);

            // * Verify the same session is extended
            await expect
                .poll(async () => Number((await getSession(initialSession.id)).expiresat), {
                    timeout: duration.half_min,
                })
                .toBeGreaterThan(nearExpiry);
            const extended = await getSession(initialSession.id);
            expect(extended.id).toBe(initialSession.id);
            expect(Number(extended.expiresat)).toBeGreaterThan(Number(initialSession.expiresat));

            // # Continue posting with the extended session
            for (let index = 0; index < 20; index++) {
                await channelsPage.postMessage(`${index}`);
            }

            // * Verify the user remains in the channel
            await expect(channelsPage.userAccountMenuButton).toBeVisible();
        },
    );

    /**
     * @objective Verify SAML user activity does not extend a near-expiry session when activity-based extension is disabled
     *
     * @precondition
     * OpenLDAP, Keycloak, and PostgreSQL are directly reachable, and the server has an enterprise license
     */
    test(
        'MM-T4047_2 SAML/SSO user session should not extend even with user activity when disabled',
        {tag: '@saml'},
        async ({pw, page}) => {
            const {adminClient, channelsPage, samlUser} = await setup(pw, page, false);
            const [initialSession] = await getActiveSessions(samlUser.id);
            expect(initialSession).toBeTruthy();
            const nearExpiry = Date.now() + duration.ten_sec;

            // # Create user activity, then move the SAML session close to expiration
            await channelsPage.postMessage(`now: ${Date.now()}`);
            const updated = await updateSessionExpiration(initialSession.id, nearExpiry);
            expect(Number(updated.expiresat)).toBe(nearExpiry);
            await adminClient.invalidateCaches();

            // * Verify the session expiration does not change
            expect(Number((await getSession(initialSession.id)).expiresat)).toBe(nearExpiry);

            // * Verify the user is redirected to login after expiration
            await expect.poll(() => Date.now(), {timeout: duration.half_min}).toBeGreaterThan(nearExpiry);
            await page.goto('/');
            await expect(page.getByRole('heading', {name: 'Log in to your account', exact: true})).toBeVisible({
                timeout: duration.half_min,
            });
            expect(await getActiveSessions(samlUser.id)).toHaveLength(0);
            expect(Number((await getSession(initialSession.id)).expiresat)).toBe(nearExpiry);
        },
    );
});

async function setup(pw: PlaywrightExtended, page: Page, extendWithActivity: boolean) {
    const {adminClient} = await pw.getAdminClient();
    const ldap = new OpenLdapClient();
    const keycloak = new KeycloakAdminClient();
    const ldapUser = createOpenLdapUser(pw);
    const keycloakLoginPage = new KeycloakLoginPage(page);
    const channelsPage = new ChannelsPage(page);

    await pw.hasSeenLandingPage();
    const idpCertificate = await keycloak.configureSamlClient(testConfig.baseURL);
    await configureSamlWithKeycloak(adminClient, {
        baseURL: testConfig.baseURL,
        enableSyncWithLdap: false,
        idpCertificate,
    });
    await adminClient.patchConfig({
        ServiceSettings: {
            SessionLengthSSOInDays: sessionLengthInDays,
            ExtendSessionLengthWithActivity: extendWithActivity,
        },
    });
    await ldap.createUser(ldapUser);
    await keycloak.createUser(ldapUser);

    // # Register the user through SAML, then remove its registration session
    await keycloakLoginPage.login(ldapUser);
    const samlUser = (await adminClient.getUserByEmail(ldapUser.email)) as UserProfile;
    const team = await adminClient.createTeam(await pw.random.team());
    await adminClient.addToTeam(team.id, samlUser.id);
    const offTopic = await adminClient.getChannelByName(team.id, 'off-topic');
    await adminClient.addToChannel(samlUser.id, offTopic.id);
    await adminClient.revokeAllSessionsForUser(samlUser.id);

    // # Log in through Keycloak/SAML with one clean session and open the assigned channel
    await keycloakLoginPage.login(ldapUser);
    await channelsPage.goto(team.name, offTopic.name);
    await channelsPage.toBeVisible();
    return {adminClient, channelsPage, samlUser};
}

function createOpenLdapUser(pw: PlaywrightExtended): LdapUser {
    const id = pw.random.id();
    const username = `saml-session-user${id}`;
    return {
        username,
        password: 'Password1',
        email: `${username}@mmtest.com`,
        firstName: `Firstname-${id}`,
        lastName: `Lastname-${id}`,
    };
}
