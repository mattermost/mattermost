// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, expect, settle, test} from '@mattermost/playwright-lib';

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
        const {app, page} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, path: 'messages', channel: `@${sharedUser.username}`});
        await expect(app.center.postCreate).toBeVisible();
        await app.channelsPage.goto({team, path: 'messages', channel: `@${firstTeamUser.username}`});
        await expect(app.center.postCreate).toBeVisible();
        await app.teamSidebar.team(secondTeam).container.click();

        // * Verify the second team opens at the top of its channel list and both DMs remain available
        await expect
            .poll(() => page.url(), {timeout: pw.duration.ten_sec})
            .toContain(`/${secondTeam.name}/channels/town-square`);
        await expect(app.lhs.header.openTeamMenuButton).toContainText(secondTeam.display_name);
        await expect(app.lhs.channelList.channel(firstDm)).toBeVisible();
        await expect(app.lhs.channelList.channel(secondDm)).toBeVisible();

        // # Post in Off-Topic on the second team, then switch back to the first team
        await app.lhs.channelList.channel('off-topic').container.click();
        await expect.poll(() => page.url()).toContain(`/${secondTeam.name}/channels/off-topic`);
        await app.center.postCreate.message.container.fill('Hello World');
        const created = await settle(app.center.postCreate.sendButton, {wait: Api.CreatePost}).click();
        await expect(app.center.postList.post(created)).toContainText('Hello World');
        await app.teamSidebar.team(team).container.click();

        // * Verify team data does not cross-contaminate and the first team's last DM is restored
        await expect(app.lhs.channelList.channel('off-topic').container).not.toHaveClass(/unread|unread-title/);
        await expect(app.lhs.channelList.channel(firstDm)).toBeVisible();
        await expect(app.lhs.channelList.channel(secondDm)).toBeVisible();
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
        await expect(app.teamSidebar.team(secondTeam).container).toHaveAccessibleName(
            `${secondTeam.display_name.toLowerCase()} team, 2 mentions`,
        );

        // # Switch to the second team to read its mentions
        await app.teamSidebar.team(secondTeam).container.click();
        await expect(app.lhs.header.openTeamMenuButton).toContainText(secondTeam.display_name);
        await app.lhs.channelList.channel('off-topic').container.click();
        await expect.poll(() => page.url()).toContain(`/${secondTeam.name}/channels/off-topic`);

        // * Verify the second team's mention badge clears
        await expect(app.teamSidebar.team(secondTeam).container).toHaveAccessibleName(
            `${secondTeam.display_name.toLowerCase()} team`,
        );

        // # Have the shared user post an ordinary message on the first team while it is in the background
        const firstTeamOffTopic = await adminClient.getChannelByName(team.id, 'off-topic');
        await sharedUserClient.createPost({
            channel_id: firstTeamOffTopic.id,
            message: 'Hey all',
        });

        // * Verify the first team reports unread activity without a mention count
        await expect(app.teamSidebar.team(team).container).toHaveAccessibleName(
            `${team.display_name.toLowerCase()} team unread`,
        );
        await expect(app.teamSidebar.team(team).unreadText).toBeVisible();
        await expect(app.teamSidebar.team(team).unreadText).toHaveText('');
    },
);
