// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import {
    expect,
    setupWebhookTestServer,
    testConfig,
} from '@mattermost/playwright-lib';

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
    pw: any,
    request: Parameters<typeof setupWebhookTestServer>[0],
    opts: SetupDialogOpenPostOpts,
) {
    await setupWebhookTestServer(request, {
        mattermostBaseUrl: testConfig.baseURL,
        adminUsername: testConfig.adminUsername,
        adminPassword: testConfig.adminPassword,
    });

    const {team, user, adminClient, userClient} = await pw.initSetup();
    const channels = await adminClient.getMyChannels(team.id);
    const townSquare = channels.find((ch: {name: string}) => ch.name === 'town-square');
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
    const integrationUrl = `${testConfig.webhookBaseUrl}${integrationPath}`;

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

export async function openBlocksDialogFromPost(channelsPage: any, marker: string, openButtonName: string) {
    const lastPost = await channelsPage.getLastPost();
    await lastPost.toBeVisible();
    await expect(lastPost.container.getByText(marker)).toBeVisible();
    await lastPost.container.getByRole('button', {name: openButtonName}).click();

    const dialog = channelsPage.page.locator('#appsModal');
    await expect(dialog).toBeVisible();
    return dialog;
}

export async function expectEphemeral(page: Page, text: string | RegExp) {
    const ephemeral = page.
        locator('.post').
        filter({hasText: text}).
        filter({hasText: '(Only visible to you)'});
    await expect(ephemeral).toBeVisible();
    return ephemeral;
}

/**
 * Create a slash command that opens a legacy Interactive Dialog (action_button parent).
 */
export async function setupLegacyActionButtonCommand(
    pw: any,
    request: Parameters<typeof setupWebhookTestServer>[0],
) {
    await setupWebhookTestServer(request, {
        mattermostBaseUrl: testConfig.baseURL,
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
        url: `${testConfig.webhookBaseUrl}/dialog/action_button_request`,
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
