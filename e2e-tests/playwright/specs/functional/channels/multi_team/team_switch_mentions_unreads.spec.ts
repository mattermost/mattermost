// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify switching teams preserves direct messages and each team's last channel, while team badges distinguish mentions from ordinary unread messages.
 */
test(
    'MM-T433 MM-T437 MM-T438 switches teams and displays multi-team mentions and unreads',
    {tag: '@multi_team'},
    async ({pw}) => {
        // # Create two teams, two users on both teams, and one user only on the first team
        const {user, team, adminClient, userClient} = await pw.initSetup();
        const [sharedUser, firstTeamUser] = await adminClient.createUsers(team.id, 2, 'multi-team');
        const {client: sharedUserClient} = await pw.makeClient(sharedUser);
        const secondTeam = await pw.createNewTeam(adminClient, {
            name: 'team',
            displayName: 'Second Team',
            type: 'O',
            unique: true,
        });
        await adminClient.addToTeam(secondTeam.id, user.id);
        await adminClient.addToTeam(secondTeam.id, sharedUser.id);

        const firstDm = await adminClient.createDirectChannel([user.id, sharedUser.id]);
        const secondDm = await adminClient.createDirectChannel([user.id, firstTeamUser.id]);
        await userClient.createPost({channel_id: firstDm.id, message: ':)'});
        await userClient.createPost({channel_id: secondDm.id, message: ':('});

        // # Open both DMs on the first team, ending on the second DM, then switch to the second team
        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, `@${sharedUser.username}`);
        await channelsPage.toBeVisible();
        await channelsPage.goto(team.name, `@${firstTeamUser.username}`);
        await channelsPage.toBeVisible();
        await channelsPage.switchToTeamByDisplayName(secondTeam.display_name);

        // * Verify the second team opens at the top of its channel list and both DMs remain available
        await expect
            .poll(() => page.url(), {timeout: pw.duration.ten_sec})
            .toContain(`/${secondTeam.name}/channels/town-square`);
        await expect(channelsPage.sidebarLeft.teamMenuButton).toContainText(secondTeam.display_name);
        await expect(channelsPage.sidebarLeft.item(sharedUser.username)).toBeVisible();
        await expect(channelsPage.sidebarLeft.item(firstTeamUser.username)).toBeVisible();

        // # Post in Off-Topic on the second team, then switch back to the first team
        await channelsPage.sidebarLeft.goToItem('off-topic');
        await channelsPage.postMessage('Hello World');
        await (await channelsPage.getLastPost()).toContainText('Hello World');
        await channelsPage.switchToTeamByDisplayName(team.display_name);

        // * Verify team data does not cross-contaminate and the first team's last DM is restored
        await channelsPage.sidebarLeft.assertItemRead('off-topic');
        await expect(channelsPage.sidebarLeft.item(sharedUser.username)).toBeVisible();
        await expect(channelsPage.sidebarLeft.item(firstTeamUser.username)).toBeVisible();
        await expect
            .poll(() => page.url(), {timeout: pw.duration.ten_sec})
            .toContain(`/${team.name}/messages/@${firstTeamUser.username}`);

        // # Have the shared user mention the test user twice in the second team's Off-Topic channel
        const secondTeamOffTopic = await adminClient.getChannelByName(secondTeam.id, 'off-topic');
        await sharedUserClient.createPost({
            channel_id: secondTeamOffTopic.id,
            message: `@${user.username} first mention`,
        });
        await sharedUserClient.createPost({
            channel_id: secondTeamOffTopic.id,
            message: `@${user.username} second mention`,
        });

        // * Verify the second team's semantic label reports two mentions
        await channelsPage.toHaveTeamMentionCount(secondTeam.display_name, 2);

        // # Switch to the second team to read its mentions
        await channelsPage.switchToTeamByDisplayName(secondTeam.display_name);
        await channelsPage.sidebarLeft.goToItem('off-topic');

        // * Verify the second team's mention badge clears
        await channelsPage.toHaveTeamNoUnread(secondTeam.display_name);

        // # Have the shared user post an ordinary message on the first team while it is in the background
        const firstTeamOffTopic = await adminClient.getChannelByName(team.id, 'off-topic');
        await sharedUserClient.createPost({
            channel_id: firstTeamOffTopic.id,
            message: 'Hey all',
        });

        // * Verify the first team reports unread activity without a mention count
        await channelsPage.toHaveTeamUnread(team.display_name, team.id);
    },
);
