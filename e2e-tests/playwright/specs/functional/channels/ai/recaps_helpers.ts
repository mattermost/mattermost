// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {Agent} from '@mattermost/types/agents';
import type {Channel} from '@mattermost/types/channels';
import type {Recap} from '@mattermost/types/recaps';

import {Api, duration, expect, settle, type App, type PlaywrightExtended} from '@mattermost/playwright-lib';

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

/** Opens the team's recaps page and waits for its heading. */
export async function openRecaps(app: App, teamName: string) {
    await app.recapsPage.goto({team: teamName});
    await expect(app.page).toHavePath(app.recapsPage.pathFor({team: teamName}));
    await expect(app.recaps.title).toContainText('Recaps', {timeout: duration.one_min});
}

/**
 * The control that opens the create-recap dialog. A user with recaps has the header "Add a recap" button; a
 * user with none has the empty state's "Create a recap" button (the header one renders only while the list
 * loads). Which one shows depends on load timing, so the two parts are combined through their locators.
 */
function createRecapControl(app: App) {
    return app.recaps.addButton.locator.or(app.recaps.placeholder.createButton.locator).first();
}

/** Opens the create-recap dialog from whichever create control the page shows. */
export async function openCreateRecap(app: App): Promise<App['createRecapModal']> {
    const control = createRecapControl(app);
    await expect(control).toBeVisible({timeout: duration.one_min});
    await control.click();
    await expect(app.createRecapModal).toBeVisible();
    return app.createRecapModal;
}

/** Verifies the create controls are disabled with the given reason. */
export async function expectCreateRecapDisabled(app: App, reason: string) {
    const control = createRecapControl(app);
    await expect(control).toBeDisabled();
    await expect(control).toHaveAttribute('title', reason);
}

/**
 * Verifies the unread tab's empty state. A user with no recaps settles on the "Set up your recap" placeholder,
 * while "You're all caught up" shows during loading or when recaps live in other tabs, so either is accepted.
 */
export async function expectCaughtUp(app: App) {
    const empty = app.recaps.caughtUp.locator.or(app.recaps.placeholder.container.locator).first();
    await expect(empty).toBeVisible({timeout: duration.one_min});
}

/** Switches the recaps page to a tab and waits for it to become active. */
export async function switchRecapsTab(app: App, tab: 'unread' | 'read' | 'scheduled') {
    await app.recaps.tab(tab).click();
    await expect(app.recaps.tab(tab)).toHaveClass(/active/);
}

/**
 * Expands a completed recap. A recap that was completed before the page loaded starts collapsed (only one that
 * finishes while the page is open expands itself), so this always toggles it open.
 */
export async function expandRecap(app: App, recap: Pick<Recap, 'id'>) {
    const item = app.recaps.recap(recap);
    await item.header.container.click();
    await expect(item.header.container).toHaveAttribute('aria-expanded', 'true');
    await expect(item.container).toHaveClass(/expanded/);
}

/** Verifies a recap shows its pending state. */
export async function expectRecapProcessing(app: App, recap: Pick<Recap, 'id'>) {
    const pending = app.recaps.processing(recap);
    await expect(pending).toContainText("Recap created. You'll receive a summary shortly");
    await expect(pending).toContainText("We're working on your recap. Check back shortly");
}

/** Fills the first step of the create-recap dialog; `runOnce` turns the recap into an immediate one. */
export async function fillRecapBasics(
    app: App,
    {
        title,
        type,
        agent,
        runOnce = false,
    }: {title: string; type: 'selected' | 'all_unreads'; agent?: Pick<Agent, 'id'>; runOnce?: boolean},
) {
    const modal = app.createRecapModal;
    await modal.nameTextbox.fill(title);
    await expect(modal.nameTextbox).toHaveValue(title);
    if (agent) {
        await modal.agent.container.clickTo(modal.agent.menu.agent(agent));
        await modal.agent.menu.agent(agent).click();
        await expect(modal.agent.menu.agent(agent)).not.toBeVisible();
    }
    await modal.type(type).click();
    await expect(modal.type(type)).toHaveClass(/selected/);
    if (runOnce) {
        await modal.runOnceSwitch.set(true);
        await expect(modal.runOnceSwitch).toBeChecked();
    }
}

/** Searches the channel step for a channel and selects it. */
export async function selectRecapChannel(app: App, channel: Channel) {
    const modal = app.createRecapModal;
    await modal.channelSearch.container.fill(channel.display_name);
    const option = modal.channel(channel);
    await expect(option).toBeVisible();
    await option.selectCheckbox.check();
    await expect(option.selectCheckbox).toBeChecked();
}

/** Starts the recap from the summary step and returns the recap the server created. */
export async function startRecap(app: App) {
    const recap = await settle(app.createRecapModal.confirmButton, {wait: Api.CreateRecap}).click();
    await expect(app.createRecapModal).not.toBeVisible({timeout: duration.ten_sec});
    return recap;
}
