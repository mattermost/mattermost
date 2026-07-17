// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@mattermost/playwright-lib';

export async function initializeLdapGroupSync(pw: any) {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    const {adminClient} = await pw.getAdminClient();
    await adminClient.initializeOpenLdap();
}

export async function setupLdapGroupSync(pw: any) {
    const {adminClient, adminUser} = await pw.getAdminClient();
    const team = await adminClient.createTeam(await pw.random.team());
    const randomUser = await pw.random.user();
    const user = {...(await adminClient.createUser(randomUser, '', '')), password: randomUser.password};
    await adminClient.addToTeam(team.id, adminUser!.id);
    await adminClient.addToTeam(team.id, user.id);
    const channel = await adminClient.createPublicChannel(team.id, 'LDAP Group Sync');
    const {groups} = await adminClient.getLdapGroups();

    const linkedGroups = [];
    for (const name of ['board', 'developers']) {
        const ldapGroup = groups.find((group: {name: string}) => group.name === name);
        expect(ldapGroup, `LDAP group ${name} should exist`).toBeTruthy();
        linkedGroups.push(
            ldapGroup.mattermost_group_id
                ? await adminClient.getGroup(ldapGroup.mattermost_group_id)
                : await adminClient.linkLdapGroup(ldapGroup.primary_key),
        );
    }

    const board = linkedGroups.find((group: {display_name: string}) => group.display_name === 'board');
    const developers = linkedGroups.find((group: {display_name: string}) => group.display_name === 'developers');
    expect(board).toBeTruthy();
    expect(developers).toBeTruthy();
    await adminClient.resetLdapGroup(board.id);
    await adminClient.resetLdapGroup(developers.id);

    return {adminClient, adminUser, user, team, channel, board, developers};
}
