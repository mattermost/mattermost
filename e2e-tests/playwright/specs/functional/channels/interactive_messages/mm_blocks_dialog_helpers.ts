// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator, Page} from '@playwright/test';

import {
    expect,
    isWebhookTestServerReachable,
    setupWebhookTestServer,
    test,
    testConfig,
} from '@mattermost/playwright-lib';
import type {ChannelsPage, PlaywrightExtended} from '@mattermost/playwright-lib';

export async function postIncomingWebhook(webhookId: string, payload: Record<string, unknown>) {
    const hookUrl = `${testConfig.baseURL}/hooks/${webhookId}`;
    const resp = await fetch(hookUrl, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
    });

    if (!resp.ok) {
        throw new Error(`Webhook POST failed: ${resp.status} ${await resp.text()}`);
    }
}

export type SetupExternalMmBlocksInThreadOpts = {
    displayName: string;
    /** Used as `E2E ${markerHint} ${randomId}` on the webhook post text. */
    markerHint: string;
    mmBlocks: unknown[];
    mmBlocksActions: Record<string, unknown>;
};

/**
 * Shared setup for external mm_blocks form tests: webhook server skip/config,
 * town-square incoming webhook, login, and opening the post in a reply thread.
 */
export async function setupExternalMmBlocksInThread(
    pw: PlaywrightExtended,
    request: Parameters<typeof setupWebhookTestServer>[0],
    opts: SetupExternalMmBlocksInThreadOpts,
) {
    test.skip(
        !(await isWebhookTestServerReachable(request)),
        [
            `Webhook test server is not reachable at ${testConfig.webhookBaseUrl}.`,
            'Start it from the repo: cd e2e-tests/cypress && npm run start:webhook',
            'Or set PW_WEBHOOK_BASE_URL when it runs elsewhere.',
        ].join('\n'),
    );

    await setupWebhookTestServer(request, {
        mattermostBaseUrl: testConfig.internalBaseURL,
        adminUsername: testConfig.adminUsername,
        adminPassword: testConfig.adminPassword,
    });

    const {team, user, adminClient} = await pw.initSetup();
    const channels = await adminClient.getMyChannels(team.id);
    const townSquare = channels.find((ch) => ch.name === 'town-square');
    if (!townSquare) {
        throw new Error('Town Square channel not found');
    }

    const webhook = await adminClient.createIncomingWebhook({
        channel_id: townSquare.id,
        display_name: opts.displayName,
    });

    const marker = `E2E ${opts.markerHint} ${pw.random.id()}`;
    await postIncomingWebhook(webhook.id, {
        text: marker,
        props: {
            mm_blocks: opts.mmBlocks,
            mm_blocks_actions: opts.mmBlocksActions,
        },
    });

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    const lastPost = await channelsPage.getLastPost();
    await lastPost.toBeVisible();
    const anchorPost = lastPost.container;

    await anchorPost.hover();
    await expect(anchorPost.getByRole('button', {name: 'reply'})).toBeVisible();
    await anchorPost.getByRole('button', {name: 'reply'}).click();

    const threadPanel = channelsPage.page.getByRole('region', {name: /Thread/});
    await expect(threadPanel).toBeVisible();

    const rootInThread = threadPanel.getByTestId('rhsPostView').filter({hasText: marker}).last();
    await expect(rootInThread).toBeVisible();

    return {
        channelsPage,
        marker,
        threadPanel,
        rootInThread,
        team,
        user,
        adminClient,
        townSquare,
    };
}

export type SetupDialogOpenPostOpts = {
    actionId?: string;
    integrationPath?: string;
    buttonText: string;
    titleHint: string;
    /** Passed to webhook as context.scenario so /mm_blocks_dialog_return can pick a fixture. */
    scenario?: string;
    /** Extra context keys merged into the button action context. */
    context?: Record<string, unknown>;
};

export async function setupDialogOpenPost(
    pw: PlaywrightExtended,
    request: Parameters<typeof setupWebhookTestServer>[0],
    opts: SetupDialogOpenPostOpts,
) {
    await setupWebhookTestServer(request, {
        mattermostBaseUrl: testConfig.internalBaseURL,
        adminUsername: testConfig.adminUsername,
        adminPassword: testConfig.adminPassword,
    });

    const {team, user, adminClient, userClient} = await pw.initSetup();
    const channels = await adminClient.getMyChannels(team.id);
    const townSquare = channels.find((ch) => ch.name === 'town-square');
    if (!townSquare) {
        throw new Error('Town Square channel not found');
    }

    const webhook = await adminClient.createIncomingWebhook({
        channel_id: townSquare.id,
        display_name: `Playwright ${opts.titleHint}`,
    });

    const marker = `E2E ${opts.titleHint} ${pw.random.id()}`;
    const actionId = opts.actionId || 'pw_dialog_return';
    const integrationPath = opts.integrationPath || '/mm_blocks_dialog_return';
    const integrationUrl = `${testConfig.webhookInternalUrl}${integrationPath}`;

    await postIncomingWebhook(webhook.id, {
        text: marker,
        props: {
            mm_blocks: [
                {type: 'text', text: `Click **${opts.buttonText}** to open a blocks dialog.`},
                {
                    type: 'button',
                    text: opts.buttonText,
                    style: 'primary',
                    action_id: actionId,
                },
            ],
            mm_blocks_actions: {
                [actionId]: {
                    type: 'external',
                    url: integrationUrl,
                    context: {
                        marker,
                        ...(opts.scenario ? {scenario: opts.scenario} : {}),
                        ...opts.context,
                    },
                },
            },
        },
    });

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    return {
        channelsPage,
        marker,
        openButtonName: opts.buttonText,
        team,
        user,
        adminClient,
        userClient,
        townSquare,
    };
}

export async function openBlocksDialogFromPost(channelsPage: ChannelsPage, marker: string, openButtonName: string) {
    const lastPost = await channelsPage.getLastPost();
    await lastPost.toBeVisible();
    await expect(lastPost.container.getByText(marker)).toBeVisible();
    await lastPost.container.getByRole('button', {name: openButtonName}).click();

    const dialog = channelsPage.page.locator('#appsModal');
    await expect(dialog).toBeVisible();
    return dialog;
}

export async function expectEphemeral(page: Page, text: string | RegExp) {
    const ephemeral = page.locator('.post').filter({hasText: text}).filter({hasText: '(Only visible to you)'});
    await expect(ephemeral).toBeVisible();
    return ephemeral;
}

/** Future calendar day relative to today (local browser timezone). */
export function getSelectableDay(offsetDays = 5): {day: string; needsNextMonth: boolean; isoDate: string} {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const now = new Date();
    return {
        day: String(d.getDate()),
        needsNextMonth: d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear(),
        isoDate: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    };
}

export async function openDatePicker(dialog: Locator, page: Page, label: string) {
    const field = dialog.locator('.mm-blocks-date-input, .mm-blocks-datetime-input').filter({hasText: label});
    await field.locator('.date-time-input, .dateTime__date .date-time-input').first().click();
    await expect(page.locator('.rdp').first()).toBeVisible();
}

export async function selectDayFromPicker(page: Page, day: string, needsNextMonth: boolean) {
    const calendar = page.locator('.rdp').first();
    await expect(calendar).toBeVisible();
    if (needsNextMonth) {
        await calendar.locator('.rdp-nav_button_next, button[name="next-month"]').first().click();
    }
    await calendar
        .locator('.rdp-day:not(.rdp-day_outside), .rdp-day:not(.rdp-day_outside) .rdp-day_button')
        .filter({hasText: new RegExp(`^${day}$`)})
        .first()
        .click();
}

/**
 * Create a slash command that opens a legacy Interactive Dialog (action_button parent).
 */
export async function setupLegacyActionButtonCommand(
    pw: PlaywrightExtended,
    request: Parameters<typeof setupWebhookTestServer>[0],
) {
    await setupWebhookTestServer(request, {
        mattermostBaseUrl: testConfig.internalBaseURL,
        adminUsername: testConfig.adminUsername,
        adminPassword: testConfig.adminPassword,
    });

    const {team, user, adminClient} = await pw.initSetup();
    const trigger = `pw_action_btn_${pw.random.id().slice(0, 8)}`;

    const command = await adminClient.addCommand({
        auto_complete: false,
        description: 'Playwright legacy action_button stacking',
        display_name: 'PW Action Button Dialog',
        icon_url: '',
        method: 'P',
        team_id: team.id,
        trigger,
        url: `${testConfig.webhookInternalUrl}/dialog/action_button_request`,
        username: '',
    } as Parameters<typeof adminClient.addCommand>[0]);

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    return {
        channelsPage,
        trigger: command.trigger,
        team,
        adminClient,
    };
}

export const dialogTags = ['@interactive_messages', '@mm_blocks', '@interactive_dialog', '@external_service'] as const;
