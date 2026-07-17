// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';

import {getRandomId, test} from '@mattermost/playwright-lib';

const ldapMember = {
    username: 'test.one',
    password: 'Password1',
    email: 'success+testone@simulator.amazonses.com',
};

test.describe('Group-synchronized team bot membership', () => {
    /**
     * @objective Verify an LDAP group-synchronized team administrator can invite and remove a bot
     */
    test('MM-21793 invites and removes a bot from a group-synchronized team', {tag: '@ldap'}, async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();
        const {adminClient, adminUser} = await pw.getAdminClient();
        await adminClient.patchConfig({ServiceSettings: {EnableBotAccountCreation: true}});
        await adminClient.initializeOpenLdap();
        const ldapGroup = await adminClient.getOrLinkLdapGroup('tgroup');
        await adminClient.resetLdapGroup(ldapGroup.id);
        const existingUser = await adminClient.getOrCreateLdapUser(ldapMember);
        await adminClient.updateUserRoles(existingUser.id, 'system_user');
        await adminClient.revokeAllSessionsForUser(existingUser.id);
        for (const existingTeam of await adminClient.getTeamsForUser(existingUser.id)) {
            await adminClient.removeFromTeam(existingTeam.id, existingUser.id);
        }
        const team = await adminClient.createTeam(await pw.random.team());
        await adminClient.addToTeam(team.id, adminUser!.id);
        await adminClient.linkGroupSyncable(ldapGroup.id, team.id, 'team', {auto_add: true});
        await adminClient.runLdapSync();

        const {user: authenticatedUser} = await pw.makeClient(ldapMember, {useCache: false});
        if (!authenticatedUser) {
            throw new Error(`Unable to authenticate LDAP user ${ldapMember.username}`);
        }
        const user = {...authenticatedUser, password: ldapMember.password} as UserProfile;
        await adminClient.createGroupTeamsAndChannels(user.id);
        await adminClient.getTeamMember(team.id, user.id);
        await adminClient.updateTeamMemberSchemeRoles(team.id, user.id, true, true);
        const bot = await adminClient.createBot({
            username: `ldap-bot-${getRandomId()}`,
            display_name: 'LDAP Group Bot',
        });

        // # Log in as the synchronized team administrator and open the team
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Invite the bot from the team invitation dialog
        await channelsPage.inviteBot(team.display_name, bot.username);

        // * Verify the bot was added to the group-synchronized team
        await adminClient.getTeamMember(team.id, bot.user_id);

        // # Remove the bot from Manage Members
        await channelsPage.goto(team.name, 'town-square');

        // * Verify the bot is no longer listed in team members
        await channelsPage.removeTeamMember(team.display_name, bot.username);
    });
});
