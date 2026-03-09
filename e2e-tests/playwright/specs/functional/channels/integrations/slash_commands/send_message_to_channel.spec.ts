// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';
import type {Team} from '@mattermost/types/teams';
import type {Channel} from '@mattermost/types/channels';
import type {Client4} from '@mattermost/client';
import type {Command} from '@mattermost/types/integrations';

import {expect, test, initSetup, requireWebhookServer} from '@mattermost/playwright-lib';

let webhookBaseUrl: string;
let adminClient: Client4;
let testUser: UserProfile;
let testTeam: Team;
let offTopicChannel: Channel;

test.beforeAll(async () => {
    webhookBaseUrl = await requireWebhookServer();

    const setup = await initSetup();
    adminClient = setup.adminClient;
    testUser = setup.user;
    testTeam = setup.team;

    const channels = await adminClient.getMyChannels(testTeam.id);
    offTopicChannel = channels.find((c) => c.name === 'off-topic')!;
});

/**
 * @objective Verify that a slash command with system_message type returns an error in the source channel but still delivers to the target channel
 */
test(
    'MM-T706 shows error in source channel when slash command sends system_message to different channel',
    {tag: '@integrations'},
    async ({pw}) => {
        // # Create slash command that sends a system_message to off-topic
        const command = await adminClient.addCommand({
            auto_complete: false,
            description: 'Error handling test',
            display_name: 'Error Handling',
            icon_url: '',
            method: 'P',
            team_id: testTeam.id,
            trigger: 'error_handling',
            url: `${webhookBaseUrl}/message-in-channel?type=system-message&channel-id=${offTopicChannel.id}`,
            username: '',
        } as Command);

        // # Log in and navigate to town-square
        const {channelsPage} = await pw.testBrowser.login(testUser);
        await channelsPage.goto(testTeam.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Post the slash command
        await channelsPage.postMessage(`/${command.trigger} `);

        // * Verify slash command error is shown in town-square
        await expect(channelsPage.page.getByText(`Command '${command.trigger}' failed to post response`)).toBeVisible({
            timeout: pw.duration.two_sec,
        });

        // # Navigate to off-topic
        await channelsPage.goto(testTeam.name, 'off-topic');
        await channelsPage.toBeVisible();

        // * Verify "Hello World" was posted in off-topic
        const lastPost = await channelsPage.getLastPost();
        await expect(lastPost.container).toContainText('Hello World', {timeout: pw.duration.two_sec});
    },
);

/**
 * @objective Verify that a slash command can send messages to a different channel than where it was issued
 */
test('MM-T707 sends message to different channel via slash command', {tag: '@integrations'}, async ({pw}) => {
    // # Create slash command that sends to off-topic (no system_message type)
    const command = await adminClient.addCommand({
        auto_complete: false,
        description: 'Cross-channel message test',
        display_name: 'Send to Different Channel',
        icon_url: '',
        method: 'P',
        team_id: testTeam.id,
        trigger: 'send_to_offtopic',
        url: `${webhookBaseUrl}/message-in-channel?channel-id=${offTopicChannel.id}`,
        username: '',
    } as Command);

    // # Log in and navigate to town-square
    const {channelsPage} = await pw.testBrowser.login(testUser);
    await channelsPage.goto(testTeam.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Post the slash command
    await channelsPage.postMessage(`/${command.trigger} `);

    // # Navigate to off-topic
    await channelsPage.goto(testTeam.name, 'off-topic');
    await channelsPage.toBeVisible();

    // * Verify both messages were posted in off-topic
    const lastPost = await channelsPage.getLastPost();
    await expect(lastPost.container).toContainText('Hello World', {timeout: pw.duration.two_sec});
});
