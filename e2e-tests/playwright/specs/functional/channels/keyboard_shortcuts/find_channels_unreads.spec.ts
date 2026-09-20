// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify Ctrl/Cmd+K lists the current team's unread channels by post recency, shows the
 * correct unread-notification badges, supports arrow-key browsing, and filters the suggestions.
 *
 * @precondition The receiving user belongs to two teams with unread posts and direct mentions.
 */
test(
    'MM-T1241 lists current-team unreads and mention counts in Find Channels',
    {tag: '@keyboard_shortcuts'},
    async ({pw}) => {
        const {adminClient, team: firstTeam, user: author} = await pw.initSetup();
        const [recipient] = await adminClient.createUsers(firstTeam.id, 1, 'unread-recipient');
        const secondTeam = await pw.createNewTeam(adminClient, {
            name: 'unread-team',
            displayName: 'Unread Team',
            type: 'O',
            unique: true,
        });
        await adminClient.addToTeam(secondTeam.id, author.id);
        await adminClient.addToTeam(secondTeam.id, recipient.id);

        // # Create three channels on each team and add both users to every channel
        const teamsAndChannels: Array<{team: Team; channels: Channel[]}> = [];
        for (const [teamIndex, team] of [firstTeam, secondTeam].entries()) {
            const channels = [];
            for (let channelIndex = 0; channelIndex < 3; channelIndex++) {
                const channel = await adminClient.createPublicChannel(team.id, `Unread ${teamIndex}-${channelIndex}`);
                await adminClient.addToChannel(author.id, channel.id);
                await adminClient.addToChannel(recipient.id, channel.id);
                channels.push(channel);
            }
            teamsAndChannels.push({team, channels});
        }

        // # Post in each channel in order, mentioning the recipient in all except one channel per team
        for (const [teamIndex, {channels}] of teamsAndChannels.entries()) {
            for (const [channelIndex, channel] of channels.entries()) {
                const message = teamIndex === channelIndex ? 'without mention' : `mention @${recipient.username}`;
                await adminClient.createPost({channel_id: channel.id, user_id: author.id, message});
            }
        }

        // # Log in as the recipient on the second team and open Find Channels
        const {channelsPage, page} = await pw.testBrowser.login(recipient);
        await channelsPage.goto(secondTeam.name, 'off-topic');
        await channelsPage.toBeVisible();
        await channelsPage.centerView.postCreate.input.focus();
        await page.keyboard.press('ControlOrMeta+K');
        const {findChannelsModal} = channelsPage;
        await expect(findChannelsModal.input).toBeFocused();

        const secondTeamChannels = teamsAndChannels[1].channels;
        const firstTeamChannels = teamsAndChannels[0].channels;

        // * Verify the newest current-team channel is selected and shows one unread plus one mention
        await findChannelsModal.toHaveOptionSelected(secondTeamChannels[2].display_name, /2 unread notifications/);

        // # Move to the next unread channel
        await findChannelsModal.input.press('ArrowDown');

        // * Verify the middle channel is selected and shows one unread without a mention
        await findChannelsModal.toHaveOptionSelected(secondTeamChannels[1].display_name, /1 unread notification/);

        // # Move to the oldest unread channel
        await findChannelsModal.input.press('ArrowDown');

        // * Verify the oldest channel is selected and shows one unread plus one mention
        await findChannelsModal.toHaveOptionSelected(secondTeamChannels[0].display_name, /2 unread notifications/);

        // # Type the middle channel's display name to filter the list
        await findChannelsModal.input.fill(secondTeamChannels[1].display_name);

        // * Verify only the matching channel from the current team is displayed
        await expect(findChannelsModal.getOption(secondTeamChannels[1].display_name)).toBeVisible();
        await expect(findChannelsModal.searchList).toHaveCount(1);
        for (const channel of firstTeamChannels) {
            await expect(findChannelsModal.getOption(channel.display_name)).toHaveCount(0);
        }
    },
);
