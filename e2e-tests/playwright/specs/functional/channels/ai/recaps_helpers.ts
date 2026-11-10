// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {Channel} from '@mattermost/types/channels';

import type {PlaywrightExtended} from '@mattermost/playwright-lib';

type RecapBridgeSetup = {
    agent: {
        id: string;
        displayName: string;
        username: string;
    };
    service: {
        id: string;
        name: string;
        type: string;
    };
};

export async function setupRecapBridge(
    pw: PlaywrightExtended,
    adminClient: Client4,
    {
        available = true,
        completions,
    }: {
        available?: boolean;
        completions: Array<{completion?: string; error?: string; status_code?: number}>;
    },
): Promise<RecapBridgeSetup> {
    await pw.enableAIBridgeTestMode(adminClient, {enableRecaps: true});
    await pw.resetAIBridgeMock(adminClient);

    const {agent, service} = await pw.createMockAIAgent(adminClient, {
        agent: {
            id: `recap-agent-${pw.random.id()}`,
            displayName: 'Recap Summary Agent',
            username: `recap.summary.${pw.random.id()}`,
            is_default: true,
        },
        service: {
            id: `recap-service-${pw.random.id()}`,
            name: 'Recap Summary Service',
            type: 'anthropic',
        },
    });

    await pw.configureAIBridgeMock(adminClient, {
        status: {available},
        agents: [agent],
        services: [service],
        agent_completions: {
            recap_summary: completions,
        },
        record_requests: true,
    });

    return {agent, service};
}

export async function createUnreadChannelFixture(
    pw: PlaywrightExtended,
    adminClient: Client4,
    adminUserId: string,
    userId: string,
    teamId: string,
    displayName: string,
    sourceMessage: string,
) {
    const channel = await adminClient.createChannel(
        pw.random.channel({
            teamId,
            name: `recap${pw.random.id()}`,
            displayName,
            unique: false,
        }),
    );

    await adminClient.addToChannel(userId, channel.id);
    await adminClient.createPost({
        channel_id: channel.id,
        user_id: adminUserId,
        message: sourceMessage,
    });

    return channel;
}

// createChannelWithManyPosts seeds a channel (with the user added as a member) and posts `postCount`
// admin messages, each padded to roughly `messageLength` characters and tagged with a unique marker so
// tests can detect exactly which posts reached the recap. Posts are returned in creation order
// (oldest first); markers[i] corresponds to posts[i].
export async function createChannelWithManyPosts(
    pw: PlaywrightExtended,
    adminClient: Client4,
    adminUserId: string,
    userId: string,
    teamId: string,
    displayName: string,
    postCount: number,
    messageLength: number,
) {
    const channel = await adminClient.createChannel(
        pw.random.channel({
            teamId,
            name: `recap${pw.random.id()}`,
            displayName,
            unique: false,
        }),
    );

    await adminClient.addToChannel(userId, channel.id);

    const runId = pw.random.id();
    const posts = [];
    const markers: string[] = [];
    for (let index = 0; index < postCount; index++) {
        const marker = `RTM-${runId}-${index}`;
        const padding = 'x'.repeat(Math.max(0, messageLength - marker.length - 1));
        const message = `${marker} ${padding}`;
        const post = await adminClient.createPost({
            channel_id: channel.id,
            user_id: adminUserId,
            message,
        });
        posts.push(post);
        markers.push(marker);
    }

    return {channel, posts, markers};
}

export async function createRecapAndWaitForStatus(
    pw: PlaywrightExtended,
    userClient: Client4,
    recapTitle: string,
    channelIds: string[],
    agentId: string,
    expectedStatus: string,
) {
    const recap = await userClient.createRecap({
        title: recapTitle,
        channel_ids: channelIds,
        agent_id: agentId,
    });

    await pw.waitUntil(
        async () => {
            const currentRecap = await userClient.getRecap(recap.id);
            return currentRecap.status === expectedStatus;
        },
        {timeout: pw.duration.one_min},
    );

    return userClient.getRecap(recap.id);
}

export async function waitForRecapStatus(
    pw: PlaywrightExtended,
    userClient: Client4,
    recapTitle: string,
    expectedStatus: string,
) {
    await pw.waitUntil(
        async () => {
            const recaps = await userClient.getRecaps(0, 60);
            return recaps.some((recap) => recap.title === recapTitle && recap.status === expectedStatus);
        },
        {timeout: pw.duration.one_min},
    );
}

export async function waitForRecordedRequestCount(pw: PlaywrightExtended, adminClient: Client4, requestCount: number) {
    await pw.waitUntil(
        async () => {
            const bridgeState = await pw.getAIBridgeMock(adminClient);
            return (
                bridgeState.recorded_requests.filter((request) => request.operation === 'recap_summary').length ===
                requestCount
            );
        },
        {timeout: pw.duration.one_min},
    );
}

export async function markAllCurrentChannelsRead(userClient: Client4, teamId: string) {
    const currentChannels = await userClient.getMyChannels(teamId);
    await userClient.readMultipleChannels(currentChannels.map((channel: Channel) => channel.id));
}
