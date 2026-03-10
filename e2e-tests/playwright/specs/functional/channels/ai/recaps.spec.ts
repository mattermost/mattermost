// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test('creates a recap with AI bridge mock responses', {tag: '@ai_recaps'}, async ({pw}) => {
    const recapHighlight = 'Deterministic highlight from the AI bridge';
    const recapActionItem = 'Deterministic action item from the AI bridge';
    const recapTitle = `AI recap ${await pw.random.id()}`;
    const sourceMessage = `Please summarize this update ${await pw.random.id()}`;
    const channelName = `airecap${await pw.random.id()}`;

    // # Initialize the test server state and enable the AI bridge test mode for recaps.
    const {adminClient, adminUser, team, user, userClient} = await pw.initSetup();
    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    await pw.enableAIBridgeTestMode(adminClient, {enableRecaps: true});
    await pw.resetAIBridgeMock(adminClient);

    // # Configure one deterministic bridge service/agent plus a single recap completion.
    const {agent, service} = await pw.createMockAIAgent(adminClient, {
        agent: {
            id: 'recap-summary-agent',
            displayName: 'Recap Summary Agent',
            username: 'recap.summary.agent',
            is_default: true,
        },
        service: {
            id: 'recap-summary-service',
            name: 'Recap Summary Service',
            type: 'anthropic',
        },
    });

    await pw.configureAIBridgeMock(adminClient, {
        status: {available: true},
        agents: [agent],
        services: [service],
        agent_completions: {
            recap_summary: [pw.recapCompletion({highlights: [recapHighlight], actionItems: [recapActionItem]})],
        },
        record_requests: true,
    });

    // # Seed a real channel post so the recap job has content to summarize.
    const channel = await adminClient.createChannel(
        pw.random.channel({
            teamId: team.id,
            name: channelName,
            displayName: 'AI Recap',
            unique: false,
        }),
    );
    await adminClient.addToChannel(user.id, channel.id);
    await adminClient.createPost({
        channel_id: channel.id,
        user_id: adminUser.id,
        message: sourceMessage,
    });

    // # Login as the end user and open the recaps page.
    const {page} = await pw.testBrowser.login(user);
    await page.goto(`/${team.name}/recaps`);

    const viewInBrowserButton = page.getByRole('button', {name: 'View in Browser'});
    if (await viewInBrowserButton.isVisible({timeout: pw.duration.ten_sec}).catch(() => false)) {
        await viewInBrowserButton.click();
    }

    const addRecapButton = page.getByRole('button', {name: 'Add a recap'});
    await expect(page.getByRole('heading', {name: 'Recaps'})).toBeVisible({timeout: pw.duration.one_min});
    await expect(addRecapButton).toBeEnabled();

    // # Walk through the recap creation flow for the seeded channel.
    await addRecapButton.click();

    const recapModal = page.locator('#createRecapModal');
    await expect(recapModal).toBeVisible();
    await recapModal.locator('#recap-name-input').fill(recapTitle);
    await recapModal.getByRole('button', {name: /Recap selected channels/i}).click();
    await recapModal.getByRole('button', {name: 'Next'}).click();

    const channelSearchInput = recapModal.getByPlaceholder('Search and select channels');
    await channelSearchInput.fill(channel.display_name);

    const channelOption = recapModal.locator('.channel-selector-item', {hasText: channel.display_name});
    await expect(channelOption).toBeVisible();
    await channelOption.click();
    await expect(channelOption.locator('input[type="checkbox"]')).toBeChecked();
    await recapModal.getByRole('button', {name: 'Next'}).click();

    await expect(recapModal.locator('.summary-channel-item', {hasText: channel.display_name})).toBeVisible();
    await recapModal.getByRole('button', {name: 'Start recap'}).click();

    // * Verify the pending recap UI is shown first.
    await expect(page.getByRole('heading', {name: recapTitle})).toBeVisible();
    await expect(page.getByText("Recap created. You'll receive a summary shortly")).toBeVisible();
    await expect(page.getByText("We're working on your recap. Check back shortly")).toBeVisible();

    // # Wait for the recap job to complete, then refresh the page to render the completed recap.
    await pw.waitUntil(
        async () => {
            const recaps = await userClient.getRecaps(0, 20);
            return recaps.some((recap) => recap.title === recapTitle && recap.status === 'completed');
        },
        {timeout: pw.duration.one_min},
    );
    await page.reload();

    const recapCard = page.locator('.recap-item', {hasText: recapTitle});
    await expect(recapCard).toBeVisible();
    await recapCard.locator('.recap-item-header').click();

    // * Verify the deterministic summary content is rendered.
    await expect(page.getByText(recapHighlight)).toBeVisible();
    await expect(page.getByText(recapActionItem)).toBeVisible();

    // * Verify the recorded bridge request used the recap_summary operation and included the seeded post.
    await pw.waitUntil(
        async () => {
            const bridgeState = await pw.getAIBridgeMock(adminClient);
            return bridgeState.recorded_requests.some((request) => request.operation === 'recap_summary');
        },
        {timeout: pw.duration.one_min},
    );

    const bridgeState = await pw.getAIBridgeMock(adminClient);
    const recapRequest = bridgeState.recorded_requests.find((request) => request.operation === 'recap_summary');

    expect(recapRequest).toBeDefined();
    expect(recapRequest?.agent_id).toBe(agent.id);
    expect(recapRequest?.messages.some((message) => message.message.includes(sourceMessage))).toBe(true);
});
