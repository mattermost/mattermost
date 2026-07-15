// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ChannelsPage, expect, KeycloakLoginPage, test, testConfig} from '@mattermost/playwright-lib';

import {configureKeycloakSaml, createKeycloakUser} from './automated_support';

test.describe('SAML automated metadata and audit behaviors', () => {
    test.describe.configure({mode: 'serial'});

    test.beforeEach(async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();
    });

    /**
     * @objective Verify service-provider metadata remains valid XML when SAML encryption is disabled
     *
     * @precondition Keycloak is available and the server has a SAML-capable license
     */
    test('MM-T3012 - Check SAML Metadata without Enable Encryption', {tag: '@saml'}, async ({pw, request}) => {
        const {adminClient} = await pw.getAdminClient();
        await configureKeycloakSaml(adminClient);

        // # Request Mattermost service-provider metadata with encryption disabled
        const response = await request.get(`${testConfig.baseURL}/api/v4/saml/metadata`);
        const metadata = await response.text();

        // * Verify the endpoint returns XML metadata without an encryption key descriptor
        expect(response.status()).toBe(200);
        expect(response.headers()['content-type']).toMatch(/^application\/xml(?:;|$)/);
        expect(metadata).toContain('<?xml version');
        expect(metadata).toContain('EntityDescriptor');
        expect(metadata).not.toContain('use="encryption"');
    });

    /**
     * @objective Verify a successful SAML login is recorded in the user's access history
     *
     * @precondition Keycloak is available and the server has a SAML-capable license
     */
    test('MM-T3280 - SAML Login Audit', {tag: '@saml'}, async ({pw, page}) => {
        const {adminClient} = await pw.getAdminClient();
        const keycloak = await configureKeycloakSaml(adminClient);
        const user = createKeycloakUser(pw, 'audit');
        await keycloak.createUser(user);
        const keycloakLoginPage = new KeycloakLoginPage(page);

        // # Register the user through SAML and assign a team and channel
        await keycloakLoginPage.login(user);
        const mattermostUser = await adminClient.getUserByEmail(user.email);
        const team = await adminClient.createTeam(await pw.random.team());
        await adminClient.addToTeam(team.id, mattermostUser.id);
        const townSquare = await adminClient.getChannelByName(team.id, 'town-square');
        await adminClient.addToChannel(mattermostUser.id, townSquare.id);
        await page.goto('about:blank');
        await page.context().clearCookies();
        await adminClient.revokeAllSessionsForUser(mattermostUser.id);

        // # Log in through SAML again and open the profile security settings
        await keycloakLoginPage.login(user);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, townSquare.name);
        await channelsPage.toBeVisible();
        const profileModal = await channelsPage.openProfileModal();

        // * Verify the SAML user lookup is present in access history
        await profileModal.expectAccessHistoryEntry('Saml obtained user');
    });
});
