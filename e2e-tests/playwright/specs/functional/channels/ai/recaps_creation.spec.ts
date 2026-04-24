// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {
    createUnreadChannelFixture,
    markAllCurrentChannelsRead,
    setupRecapBridge,
    waitForRecapStatus,
    waitForRecordedRequestCount,
} from './support';

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
