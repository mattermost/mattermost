// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';

import {SystemConsolePage, type ChannelsPage} from '@mattermost/playwright-lib';

export const boardAccount = {
    username: 'board.one',
    password: 'Password1',
    email: 'success+boardone@simulator.amazonses.com',
};

export async function setup(pw: any) {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    const {adminClient, adminUser} = await pw.getAdminClient();
    await adminClient.configureOpenLdap();
    await adminClient.resetOpenLdapTestState();
    const boardGroup = await adminClient.getOrLinkLdapGroup('board');
    await adminClient.resetLdapGroup(boardGroup.id);
    await adminClient.patchConfig({GuestAccountsSettings: {Enable: true}});
    await resetMentionPermissions(adminClient);

    const team = await adminClient.createTeam(await pw.random.team());
    await adminClient.addToTeam(team.id, adminUser.id);
    const offTopic = await adminClient.getChannelByName(team.id, 'off-topic');
    const randomUser = await pw.random.user();
    const regularUser = {
        ...(await adminClient.createUser(randomUser, '', '')),
        password: randomUser.password,
    } as UserProfile;
    await adminClient.addToTeam(team.id, regularUser.id);
    await adminClient.addToChannel(regularUser.id, offTopic.id);

    const {user: existingBoardUser, created} = await adminClient.getOrCreateLdapUserWithStatus(boardAccount);
    if (created || !boardGroup.member_count) {
        await adminClient.runLdapSync();
    }
    await adminClient.updateUserRoles(existingBoardUser.id, 'system_user');
    await adminClient.revokeAllSessionsForUser(existingBoardUser.id);
    for (const existingTeam of await adminClient.getTeamsForUser(existingBoardUser.id)) {
        await adminClient.removeFromTeam(existingTeam.id, existingBoardUser.id);
    }
    const {user: authenticatedBoardUser} = await pw.makeClient(boardAccount, {useCache: false});
    if (!authenticatedBoardUser) {
        throw new Error(`Unable to authenticate LDAP user ${boardAccount.username}`);
    }
    const boardUser = {...authenticatedBoardUser, password: boardAccount.password} as UserProfile;
    await adminClient.addToTeam(team.id, boardUser.id);
    await adminClient.addToChannel(boardUser.id, offTopic.id);
    await adminClient.savePreferences(boardUser.id, [
        {user_id: boardUser.id, category: 'tutorial_step', name: boardUser.id, value: '999'},
    ]);

    return {adminClient, adminUser, boardGroup, boardUser, regularUser, team};
}

export async function composeGroupMention(pw: any, user: UserProfile, teamName: string, groupName: string) {
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(teamName, 'off-topic');
    await channelsPage.toBeVisible();
    await channelsPage.centerView.postCreate.writeMessage(`@${groupName.slice(0, -1)}`);
    return channelsPage;
}

export async function verifyMentionEnabled(
    pw: any,
    channelsPage: ChannelsPage,
    boardUser: UserProfile,
    teamName: string,
    groupName: string,
) {
    await channelsPage.postGroupMention(groupName);
    await channelsPage.assertMentionIsLinked(groupName);

    const {channelsPage: boardChannelsPage} = await pw.testBrowser.login(boardUser);
    await boardChannelsPage.goto(teamName, 'off-topic');
    await boardChannelsPage.toBeVisible();
    await boardChannelsPage.assertMentionIsHighlighted(groupName);
}

export async function verifyMentionDisabled(
    pw: any,
    channelsPage: ChannelsPage,
    boardUser: UserProfile,
    teamName: string,
    groupName: string,
) {
    await channelsPage.postGroupMention(groupName);
    await channelsPage.assertMentionIsPlainText(groupName);

    const {channelsPage: boardChannelsPage} = await pw.testBrowser.login(boardUser);
    await boardChannelsPage.goto(teamName, 'off-topic');
    await boardChannelsPage.toBeVisible();
    await boardChannelsPage.assertMentionIsPlainText(groupName);
}

export async function enableMention(adminClient: any, groupId: string, groupName: string) {
    await adminClient.patchGroup(groupId, {allow_reference: true, name: groupName});
}

export async function openChannel(
    pw: any,
    user: UserProfile,
    teamName: string,
    channelName: string,
    messageRoute = false,
) {
    const {channelsPage} = await pw.testBrowser.login(user);
    if (messageRoute) {
        await channelsPage.gotoMessage(teamName, channelName);
    } else {
        await channelsPage.goto(teamName, channelName);
    }
    await channelsPage.toBeVisible();
    return channelsPage;
}

export async function configureMentionPermissions(
    pw: any,
    adminUser: UserProfile,
    permissions: Parameters<SystemConsolePage['permissionsSystemScheme']['setGroupMentionPermissions']>[0],
) {
    const {page} = await pw.testBrowser.login(adminUser);
    const consolePage = new SystemConsolePage(page);
    await consolePage.permissionsSystemScheme.goto();
    await consolePage.permissionsSystemScheme.setGroupMentionPermissions(permissions);
}

export async function resetMentionPermissions(adminClient: any) {
    const permission = 'use_group_mentions';
    const enabledRoles = new Set(['channel_user', 'channel_admin', 'team_admin', 'channel_guest']);
    const roles = await adminClient.getRolesByNames([...enabledRoles]);
    if (roles.length !== enabledRoles.size) {
        throw new Error('Unable to restore all group mention permission roles');
    }

    await Promise.all(
        roles.map((role: {id: string; name: string; permissions: string[]}) => {
            const permissions = [...new Set([...role.permissions, permission])];
            return permissions.length === role.permissions.length
                ? Promise.resolve()
                : adminClient.patchRole(role.id, {permissions});
        }),
    );
}
