// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, expectSignedIn, logIn, openLogin, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify demoting an LDAP user to guest changes their role but keeps their team membership.
 *
 * @precondition
 * A licensed server with OpenLDAP.
 */
test(
    'MM-T1425 demoting an LDAP user to guest changes their role but keeps team membership',
    {tag: '@ldap'},
    async ({pw, page}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();

        const {adminClient, team} = await pw.initSetup();
        await pw.ensureOpenldap();

        const ldapUser = pw.generateLdapUser('ldapdemote');
        await pw.createLdapUser(ldapUser);

        await adminClient.patchConfig({GuestAccountsSettings: {Enable: true}});

        // # Log in as the LDAP user to provision them
        const app = await openLogin(pw, page);
        await logIn(app, ldapUser.username, ldapUser.password);
        await expectSignedIn(page);

        // # Add the user to a team, then demote them to guest
        const provisionedUser = await adminClient.getUserByUsername(ldapUser.username);
        await adminClient.addToTeam(team.id, provisionedUser.id);
        await adminClient.demoteUserToGuest(provisionedUser.id);

        // * Verify the user is a guest and still on the team
        const demotedUser = await adminClient.getUserByUsername(ldapUser.username);
        expect(demotedUser.roles.split(' ')).toContain('system_guest');
        const teamMembership = await adminClient.getTeamMember(team.id, provisionedUser.id);
        expect(teamMembership.team_id).toBe(team.id);
    },
);
