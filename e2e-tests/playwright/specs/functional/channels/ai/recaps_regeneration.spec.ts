// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {
    createRecapAndWaitForStatus,
    createUnreadChannelFixture,
    setupRecapBridge,
    waitForRecapStatus,
    waitForRecordedRequestCount,
} from './support';

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
