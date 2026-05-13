// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {Channel} from '@mattermost/types/channels';

import {expect, test} from '@mattermost/playwright-lib';
import type {PlaywrightExtended} from '@mattermost/playwright-lib';

/**
 * @objective Verify a user can create a selected-channels AI recap and receive the mocked summary without reloading the page
 */
test('creates selected-channels recap and auto-renders mocked summary', {tag: '@ai_recaps'}, async ({pw}) => {
    const recapHighlight = `Deterministic highlight ${pw.random.id()}`;
    const recapActionItem = `Deterministic action item ${pw.random.id()}`;
    const recapTitle = `AI recap ${pw.random.id()}`;
    const sourceMessage = `Please summarize this update ${pw.random.id()}`;

    // # Initialize the test server state and configure one deterministic recap agent.
    const {adminClient, adminUser, team, user, userClient} = await pw.initSetup();
    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    const {agent} = await setupRecapBridge(pw, adminClient, {
        completions: [
            pw.recapCompletion({
                highlights: [recapHighlight],
                actionItems: [recapActionItem],
            }),
        ],
    });

    // # Seed a real unread post so the recap job has content to summarize.
    const channel = await createUnreadChannelFixture(
        pw,
        adminClient,
        adminUser.id,
        user.id,
        team.id,
        'AI Recap Selected Channel',
        sourceMessage,
    );

    // # Login as the end user, create the recap through the selected-channels modal flow, and submit it.
    const {recapsPage} = await pw.testBrowser.login(user);
    await recapsPage.goto(team.name);
    await recapsPage.toBeVisible();

    const createRecapModal = await recapsPage.openCreateRecap();
    await createRecapModal.fillTitle(recapTitle);
    await createRecapModal.selectSelectedChannels();
    await createRecapModal.clickNext();
    await createRecapModal.expectChannelSelectorVisible();
    await createRecapModal.searchChannel(channel.display_name);
    await createRecapModal.selectChannel(channel.display_name);
    await createRecapModal.clickNext();
    await createRecapModal.expectSummaryChannels([channel.display_name]);
    await createRecapModal.startRecap();

    // * Verify the recap first appears in its pending state.
    const recap = recapsPage.getRecap(recapTitle);
    await recap.toBeVisible();
    await recap.expectProcessing();

    // * Verify the recap completes and renders the mocked summary content without a manual page reload.
    await waitForRecapStatus(pw, userClient, recapTitle, 'completed');
    await expect(recap.container).toContainText(recapHighlight, {timeout: pw.duration.one_min});
    await expect(recap.container).toContainText(recapActionItem, {timeout: pw.duration.one_min});

    // * Verify the recorded bridge request used the recap_summary operation and included the unread source message.
    await waitForRecordedRequestCount(pw, adminClient, 1);
    const bridgeState = await pw.getAIBridgeMock(adminClient);
    const recapRequest = bridgeState.recorded_requests.find((request) => request.operation === 'recap_summary');

    expect(recapRequest).toBeDefined();
    expect(recapRequest?.agent_id).toBe(agent.id);
    expect(recapRequest?.messages.some((message) => message.message.includes(sourceMessage))).toBe(true);
});

/**
 * @objective Verify the all-unreads recap flow skips channel selection and only summarizes unread channels
 */
test('creates all-unreads recap for only unread channels', {tag: '@ai_recaps'}, async ({pw}) => {
    const recapTitle = `Unread recap ${pw.random.id()}`;
    const sourceMessageOne = `Unread source one ${pw.random.id()}`;
    const sourceMessageTwo = `Unread source two ${pw.random.id()}`;
    const highlightOne = `Unread highlight one ${pw.random.id()}`;
    const highlightTwo = `Unread highlight two ${pw.random.id()}`;

    // # Initialize the test server state, clear baseline unread state, and configure two deterministic recap completions.
    const {adminClient, adminUser, team, user, userClient} = await pw.initSetup();
    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    await markAllCurrentChannelsRead(userClient, team.id);

    const {agent} = await setupRecapBridge(pw, adminClient, {
        completions: [
            pw.recapCompletion({
                highlights: [highlightOne],
                actionItems: [],
            }),
            pw.recapCompletion({
                highlights: [highlightTwo],
                actionItems: [],
            }),
        ],
    });

    const firstChannel = await createUnreadChannelFixture(
        pw,
        adminClient,
        adminUser.id,
        user.id,
        team.id,
        'Unread recap one',
        sourceMessageOne,
    );
    const secondChannel = await createUnreadChannelFixture(
        pw,
        adminClient,
        adminUser.id,
        user.id,
        team.id,
        'Unread recap two',
        sourceMessageTwo,
    );

    // # Open the all-unreads modal flow and advance directly to the summary step.
    const {recapsPage} = await pw.testBrowser.login(user);
    await recapsPage.goto(team.name);
    await recapsPage.toBeVisible();

    const createRecapModal = await recapsPage.openCreateRecap();
    await createRecapModal.fillTitle(recapTitle);
    await createRecapModal.selectAgent(agent.displayName);
    await createRecapModal.selectAllUnreads();
    await createRecapModal.clickNext();

    // * Verify the all-unreads flow skips the channel selector and includes only the unread channels in the summary.
    await createRecapModal.expectChannelSelectorHidden();
    await createRecapModal.expectSummaryChannels([firstChannel.display_name, secondChannel.display_name]);
    await createRecapModal.startRecap();

    // * Verify the completed recap renders summaries for both unread channels.
    const recap = recapsPage.getRecap(recapTitle);
    await expect(recap.container).toContainText(highlightOne, {timeout: pw.duration.one_min});
    await expect(recap.container).toContainText(highlightTwo, {timeout: pw.duration.one_min});
    await expect(recap.container).toContainText(firstChannel.display_name);
    await expect(recap.container).toContainText(secondChannel.display_name);

    // * Verify the bridge recorded one recap_summary request per unread channel and included both source messages.
    await waitForRecordedRequestCount(pw, adminClient, 2);
    const bridgeState = await pw.getAIBridgeMock(adminClient);
    const recapRequests = bridgeState.recorded_requests.filter((request) => request.operation === 'recap_summary');

    expect(recapRequests).toHaveLength(2);
    expect(
        recapRequests.some((request) => request.messages.some((message) => message.message.includes(sourceMessageOne))),
    ).toBe(true);
    expect(
        recapRequests.some((request) => request.messages.some((message) => message.message.includes(sourceMessageTwo))),
    ).toBe(true);
});

/**
 * @objective Verify recap creation is disabled when the AI bridge reports itself as unavailable
 */
test('disables recap creation when the bridge is unavailable', {tag: '@ai_recaps'}, async ({pw}) => {
    // # Initialize the test server state and configure the recap bridge as unavailable.
    const {adminClient, team, user} = await pw.initSetup();
    await setupRecapBridge(pw, adminClient, {
        available: false,
        completions: [],
    });

    // # Open the recaps page as the end user.
    const {recapsPage} = await pw.testBrowser.login(user);
    await recapsPage.goto(team.name);
    await recapsPage.toBeVisible();

    // * Verify the page shows the caught-up empty state and disables the Add a recap button with the expected reason.
    await recapsPage.expectCaughtUpEmptyState();
    await recapsPage.expectAddRecapDisabled('Agents Bridge is not enabled');
});

/**
 * @objective Verify marking a recap as read moves it from the Unread tab to the Read tab
 */
test('moves a recap from unread to read when marked read', {tag: '@ai_recaps'}, async ({pw}) => {
    const recapTitle = `Read state recap ${pw.random.id()}`;
    const recapHighlight = `Read state highlight ${pw.random.id()}`;
    const sourceMessage = `Read state source ${pw.random.id()}`;

    // # Initialize the test server state, configure the recap bridge, and seed a completed recap for the user.
    const {adminClient, adminUser, team, user, userClient} = await pw.initSetup();
    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    const {agent} = await setupRecapBridge(pw, adminClient, {
        completions: [
            pw.recapCompletion({
                highlights: [recapHighlight],
                actionItems: [],
            }),
        ],
    });

    const channel = await createUnreadChannelFixture(
        pw,
        adminClient,
        adminUser.id,
        user.id,
        team.id,
        'Read state channel',
        sourceMessage,
    );
    await createRecapAndWaitForStatus(pw, userClient, recapTitle, [channel.id], agent.id, 'completed');

    // # Open the unread recap and mark it as read from the recap card.
    const {recapsPage} = await pw.testBrowser.login(user);
    await recapsPage.goto(team.name);
    await recapsPage.toBeVisible();

    const unreadRecap = recapsPage.getRecap(recapTitle);
    await unreadRecap.toBeVisible();
    await unreadRecap.clickMarkRead();

    // * Verify the recap disappears from the Unread tab and appears in the Read tab with the inline Mark read button removed.
    await recapsPage.expectRecapNotVisible(recapTitle);
    await recapsPage.switchToRead();

    const readRecap = recapsPage.getRecap(recapTitle);
    await readRecap.toBeVisible();
    await expect(readRecap.markReadButton).not.toBeVisible();
    await expect(readRecap.menuButton).toBeVisible();
});

/**
 * @objective Verify deleting a recap removes it from the recaps list
 */
test('deletes a recap from the recaps page', {tag: '@ai_recaps'}, async ({pw}) => {
    const recapTitle = `Delete recap ${pw.random.id()}`;
    const recapHighlight = `Delete recap highlight ${pw.random.id()}`;
    const sourceMessage = `Delete recap source ${pw.random.id()}`;

    // # Initialize the test server state, configure the recap bridge, and seed a completed recap for the user.
    const {adminClient, adminUser, team, user, userClient} = await pw.initSetup();
    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    const {agent} = await setupRecapBridge(pw, adminClient, {
        completions: [
            pw.recapCompletion({
                highlights: [recapHighlight],
                actionItems: [],
            }),
        ],
    });

    const channel = await createUnreadChannelFixture(
        pw,
        adminClient,
        adminUser.id,
        user.id,
        team.id,
        'Delete recap channel',
        sourceMessage,
    );
    await createRecapAndWaitForStatus(pw, userClient, recapTitle, [channel.id], agent.id, 'completed');

    // # Open the recap, trigger the delete action, and confirm the delete modal.
    const {recapsPage} = await pw.testBrowser.login(user);
    await recapsPage.goto(team.name);
    await recapsPage.toBeVisible();

    const recap = recapsPage.getRecap(recapTitle);
    await recap.toBeVisible();
    await recap.clickDelete();
    await recapsPage.confirmDelete();

    // * Verify the recap disappears from the list and the page returns to the setup placeholder.
    await recapsPage.expectRecapNotVisible(recapTitle);
    await recapsPage.expectSetupPlaceholder();
});

/**
 * @objective Verify regenerating a recap returns it to processing and replaces the rendered summary with the latest mocked response
 */
test('regenerates a recap with a new mocked summary', {tag: '@ai_recaps'}, async ({pw}) => {
    const recapTitle = `Regenerated recap ${pw.random.id()}`;
    const firstHighlight = `Original summary ${pw.random.id()}`;
    const secondHighlight = `Regenerated summary ${pw.random.id()}`;
    const sourceMessage = `Regenerate source ${pw.random.id()}`;

    // # Initialize the test server state, queue two recap completions, and seed the first completed recap.
    const {adminClient, adminUser, team, user, userClient} = await pw.initSetup();
    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    const {agent} = await setupRecapBridge(pw, adminClient, {
        completions: [
            pw.recapCompletion({
                highlights: [firstHighlight],
                actionItems: [],
            }),
            pw.recapCompletion({
                highlights: [secondHighlight],
                actionItems: [],
            }),
        ],
    });

    const channel = await createUnreadChannelFixture(
        pw,
        adminClient,
        adminUser.id,
        user.id,
        team.id,
        'Regenerate recap channel',
        sourceMessage,
    );
    await createRecapAndWaitForStatus(pw, userClient, recapTitle, [channel.id], agent.id, 'completed');

    // # Open the recap, confirm the original summary is visible, and trigger regeneration from the recap menu.
    const {recapsPage} = await pw.testBrowser.login(user);
    await recapsPage.goto(team.name);
    await recapsPage.toBeVisible();

    const recap = recapsPage.getRecap(recapTitle);
    await recap.expand();
    await recap.expectText(firstHighlight);
    await recap.openMenuAction('Regenerate this recap');

    // * Verify the recap returns to the processing state and then renders the regenerated summary.
    await recap.expectProcessing();
    await expect(recap.container).toContainText(secondHighlight, {timeout: pw.duration.one_min});
    await expect(recap.container).not.toContainText(firstHighlight);

    // * Verify two recap_summary requests were recorded for the original generation and the regeneration.
    await waitForRecordedRequestCount(pw, adminClient, 2);
    const bridgeState = await pw.getAIBridgeMock(adminClient);
    const recapRequests = bridgeState.recorded_requests.filter((request) => request.operation === 'recap_summary');
    expect(recapRequests).toHaveLength(2);
});

/**
 * @objective Verify a failed recap renders the failed state and can recover after regeneration
 */
test('recovers a failed recap through regeneration', {tag: '@ai_recaps'}, async ({pw}) => {
    const recapTitle = `Failed recap ${pw.random.id()}`;
    const recoveredHighlight = `Recovered highlight ${pw.random.id()}`;
    const sourceMessage = `Failed recap source ${pw.random.id()}`;

    // # Initialize the test server state, queue a failing completion followed by a successful completion, and seed the failed recap.
    const {adminClient, adminUser, team, user, userClient} = await pw.initSetup();
    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    const {agent} = await setupRecapBridge(pw, adminClient, {
        completions: [
            {error: 'deterministic recap failure', status_code: 500},
            pw.recapCompletion({
                highlights: [recoveredHighlight],
                actionItems: [],
            }),
        ],
    });

    const channel = await createUnreadChannelFixture(
        pw,
        adminClient,
        adminUser.id,
        user.id,
        team.id,
        'Failed recap channel',
        sourceMessage,
    );
    await createRecapAndWaitForStatus(pw, userClient, recapTitle, [channel.id], agent.id, 'failed');

    // # Open the failed recap and trigger regeneration from the recap menu.
    const {recapsPage} = await pw.testBrowser.login(user);
    await recapsPage.goto(team.name);
    await recapsPage.toBeVisible();

    const failedRecap = recapsPage.getRecap(recapTitle);
    await failedRecap.toBeVisible();
    await failedRecap.expectFailed();
    await expect(failedRecap.markReadButton).not.toBeVisible();
    await failedRecap.openMenuAction('Regenerate this recap');

    // * Verify the failed recap returns to processing and then recovers into a completed recap.
    await failedRecap.expectProcessing();
    await waitForRecapStatus(pw, userClient, recapTitle, 'completed');
    await recapsPage.page.reload();
    await recapsPage.toBeVisible();
    await failedRecap.expand();
    await expect(failedRecap.container).toContainText(recoveredHighlight, {timeout: pw.duration.one_min});
});

/**
 * @objective Verify recap channel card actions can mark a source channel as read and navigate back into that channel
 */
test('executes recap channel card actions', {tag: '@ai_recaps'}, async ({pw}) => {
    const recapTitle = `Channel actions recap ${pw.random.id()}`;
    const recapHighlight = `Channel action highlight ${pw.random.id()}`;
    const sourceMessage = `Channel action source ${pw.random.id()}`;

    // # Initialize the test server state, configure the recap bridge, and seed a completed recap with one unread channel.
    const {adminClient, adminUser, team, user, userClient} = await pw.initSetup();
    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    const {agent} = await setupRecapBridge(pw, adminClient, {
        completions: [
            pw.recapCompletion({
                highlights: [recapHighlight],
                actionItems: [],
            }),
        ],
    });

    const channel = await createUnreadChannelFixture(
        pw,
        adminClient,
        adminUser.id,
        user.id,
        team.id,
        'Channel action recap',
        sourceMessage,
    );
    await createRecapAndWaitForStatus(pw, userClient, recapTitle, [channel.id], agent.id, 'completed');

    // # Open the recap, mark the recap channel as read from the channel card, and then navigate back into the source channel.
    const {page, recapsPage} = await pw.testBrowser.login(user);
    await recapsPage.goto(team.name);
    await recapsPage.toBeVisible();

    const recap = recapsPage.getRecap(recapTitle);
    await recap.expand();

    const recapChannelCard = recap.getChannelCard(channel.display_name);
    await recapChannelCard.toBeVisible();
    await recapChannelCard.openMenuAction('Mark this channel as read');

    // * Verify the recap channel read action clears the unread count for the summarized channel.
    await pw.waitUntil(
        async () => {
            const channelMember = await userClient.getMyChannelMember(channel.id);
            return channelMember.mention_count === 0;
        },
        {timeout: pw.duration.one_min},
    );

    // # Use the channel card to navigate back into the original channel.
    await recapChannelCard.clickChannelName();

    // * Verify the user lands back in the source channel route.
    await expect(page).toHaveURL(new RegExp(`/${team.name}/channels/${channel.name}$`));
});

async function setupRecapBridge(
    pw: PlaywrightExtended,
    adminClient: Client4,
    {
        available = true,
        completions,
    }: {
        available?: boolean;
        completions: Array<{completion?: string; error?: string; status_code?: number}>;
    },
) {
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

async function createUnreadChannelFixture(
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

async function createRecapAndWaitForStatus(
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

async function waitForRecapStatus(
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

async function waitForRecordedRequestCount(pw: PlaywrightExtended, adminClient: Client4, requestCount: number) {
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

async function markAllCurrentChannelsRead(userClient: Client4, teamId: string) {
    const currentChannels = await userClient.getMyChannels(teamId);
    await userClient.readMultipleChannels(currentChannels.map((channel: Channel) => channel.id));
}
