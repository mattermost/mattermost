// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, expectSignedIn, logIn, openLogin, test, DefaultChannel} from '@mattermost/playwright-lib';

/**
 * @objective Verify an LDAP member added to a team lands on that team after logging in again.
 *
 * @precondition
 * A licensed server with OpenLDAP.
 */
test('LDAP member login with team invite lands on the invited team', {tag: '@ldap'}, async ({pw, page}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminClient, team} = await pw.initSetup();
    await pw.ensureOpenldap();

    const ldapUser = pw.generateLdapUser('ldapmember');
    await pw.createLdapUser(ldapUser);

    // # Log in once to provision the user
    let app = await openLogin(pw, page);
    await logIn(app, ldapUser.username, ldapUser.password);
    await expectSignedIn(page);

    // # Add the user to the team and log them out
    const provisionedUser = await adminClient.getUserByUsername(ldapUser.username);
    await adminClient.addToTeam(team.id, provisionedUser.id);
    await adminClient.revokeAllSessionsForUser(provisionedUser.id);

    // # Log in again
    app = await openLogin(pw, page);
    await logIn(app, ldapUser.username, ldapUser.password);

    // * Verify the user lands on the team
    await expect(page).toHavePath(app.channelsPage.pathFor({team, channel: DefaultChannel.TownSquare}));
    await expect(app.center.postCreate.message.container).toBeVisible();
});

/**
 * @objective Verify an LDAP guest added to a team and channel lands on that channel after logging in again.
 *
 * @precondition
 * A licensed server with OpenLDAP.
 */
test('LDAP guest login with team invite lands on the invited channel', {tag: '@ldap'}, async ({pw, page}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminClient, team} = await pw.initSetup();
    await pw.ensureOpenldap();

    const ldapUser = pw.generateLdapUser('ldapguestinv');
    await pw.createLdapUser(ldapUser);

    await adminClient.patchConfig({
        GuestAccountsSettings: {Enable: true},
        LdapSettings: {UserFilter: '(cn=no_such_user)', GuestFilter: `(cn=${ldapUser.firstname})`},
    });

    // # Log in once to provision the guest
    let app = await openLogin(pw, page);
    await logIn(app, ldapUser.username, ldapUser.password);
    await expectSignedIn(page);

    const provisionedUser = await adminClient.getUserByUsername(ldapUser.username);
    expect(provisionedUser.roles.split(' ')).toContain('system_guest');

    // # Add the guest to the team and its town square, and log them out
    await adminClient.addToTeam(team.id, provisionedUser.id);
    const townSquare = await adminClient.getChannelByName(team.id, DefaultChannel.TownSquare);
    await adminClient.addToChannel(provisionedUser.id, townSquare.id);
    await adminClient.revokeAllSessionsForUser(provisionedUser.id);

    // # Log in again
    app = await openLogin(pw, page);
    await logIn(app, ldapUser.username, ldapUser.password);

    // * Verify the guest lands on the channel
    await expect(page).toHavePath(app.channelsPage.pathFor({team, channel: DefaultChannel.TownSquare}));
    await expect(app.center.postCreate.message.container).toBeVisible();
});
