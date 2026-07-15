// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    ChannelsPage,
    configureSamlWithKeycloak,
    expect,
    KeycloakAdminClient,
    KeycloakLoginPage,
    LoginPage,
    test,
    testConfig,
} from '@mattermost/playwright-lib';
import type {KeycloakUser, PlaywrightExtended} from '@mattermost/playwright-lib';

test.describe('SAML team invitation', () => {
    test.beforeEach(async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();
    });

    /**
     * @objective Verify an invited user can use a copied team invite link to register through SAML
     *
     * @precondition Keycloak is available and the server has a SAML-capable license
     */
    test('Saml login invited Guest user to a team', {tag: '@saml'}, async ({pw, page}) => {
        const {adminClient} = await pw.getAdminClient();
        const keycloak = new KeycloakAdminClient();
        const idpCertificate = await keycloak.configureSamlClient(testConfig.baseURL);
        await configureSamlWithKeycloak(adminClient, {
            baseURL: testConfig.baseURL,
            enableSyncWithLdap: false,
            enableGuestAccess: true,
            guestAttribute: '',
            enableAdminAttribute: false,
            adminAttribute: '',
            idpCertificate,
        });
        const inviter = createKeycloakUser(pw, 'inviter');
        const invitee = createKeycloakUser(pw, 'invited-guest');
        await keycloak.createUser(inviter);
        await keycloak.createUser(invitee);
        const keycloakLoginPage = new KeycloakLoginPage(page);

        // # Register the inviter through SAML and give the account a team
        await keycloakLoginPage.login(inviter);
        const inviterProfile = await adminClient.getUserByEmail(inviter.email);
        const team = await adminClient.createTeam(await pw.random.team());
        await adminClient.addToTeam(team.id, inviterProfile.id);
        const townSquare = await adminClient.getChannelByName(team.id, 'town-square');
        await adminClient.addToChannel(inviterProfile.id, townSquare.id);
        await keycloakLoginPage.login(inviter);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, townSquare.name);
        await channelsPage.toBeVisible();

        // # Copy the team invite link through the visible Invite People dialog
        const invitePeopleModal = await channelsPage.openInvitePeopleModal(team.display_name);
        const inviteURL = await invitePeopleModal.copyInviteLink();
        await invitePeopleModal.close();
        expect(inviteURL).toContain(`/signup_user_complete/?id=${team.invite_id}`);

        // # Open the copied invitation and choose SAML registration
        await page.context().clearCookies();
        await page.goto(inviteURL);
        const loginPage = new LoginPage(page);
        await loginPage.loginWithSaml();
        await keycloakLoginPage.submit(invitee);

        // * Verify the invitee is registered and joined to the invited team
        const inviteeProfile = await adminClient.getUserByEmail(invitee.email);
        const teams = await adminClient.getTeamsForUser(inviteeProfile.id);
        expect(teams.map((candidate) => candidate.id)).toContain(team.id);
        await channelsPage.goto(team.name, townSquare.name);
        await channelsPage.toBeVisible();
    });
});

function createKeycloakUser(pw: PlaywrightExtended, prefix: string): KeycloakUser {
    const id = pw.random.id();
    return {
        username: `saml-${prefix}-${id}`,
        password: 'Password1!',
        email: `saml-${prefix}-${id}@mmtest.com`,
        firstName: 'SAML',
        lastName: prefix,
    };
}
