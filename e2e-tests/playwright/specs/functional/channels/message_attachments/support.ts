// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {testConfig} from '@mattermost/playwright-lib';

/**
 * Posts a JSON payload to an incoming webhook URL.
 */
export async function postToWebhook(webhookId: string, payload: Record<string, unknown>) {
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

/**
 * Locates the `town-square` channel in the given team and creates an
 * incoming webhook bound to it. Throws if the channel isn't found.
 *
 * This wraps the pattern duplicated across every message-attachment spec:
 * - initSetup → get team
 * - find town-square in adminClient.getMyChannels(team.id)
 * - adminClient.createIncomingWebhook({channel_id, display_name})
 *
 * @param adminClient - Admin Client4 returned from `pw.initSetup`
 * @param teamId - Team ID from `pw.initSetup`
 * @param displayName - Display name for the created webhook
 */
export async function createTownSquareWebhook(
    adminClient: any,
    teamId: string,
    displayName: string,
): Promise<{webhookId: string; townSquareId: string}> {
    const channels = await adminClient.getMyChannels(teamId);
    const townSquare = channels.find((ch: any) => ch.name === 'town-square');
    if (!townSquare) {
        throw new Error('Town Square channel not found');
    }

    const webhook = await adminClient.createIncomingWebhook({
        channel_id: townSquare.id,
        display_name: displayName,
    });

    return {webhookId: webhook.id, townSquareId: townSquare.id};
}
