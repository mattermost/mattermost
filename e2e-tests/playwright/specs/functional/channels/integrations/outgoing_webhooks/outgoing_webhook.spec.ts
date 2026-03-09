// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';
import type {Team} from '@mattermost/types/teams';
import type {OutgoingWebhook} from '@mattermost/types/integrations';
import type {Client4} from '@mattermost/client';

import {expect, test, initSetup, requireWebhookServer, registerOutgoingResponse} from '@mattermost/playwright-lib';

let adminClient: Client4;
let testUser: UserProfile;
let testTeam: Team;

test.beforeAll(async () => {
    await requireWebhookServer();

    const setup = await initSetup();
    adminClient = setup.adminClient;
    testUser = setup.user;
    testTeam = setup.team;
});

/**
 * @objective Verify that deleting an outgoing webhook stops it from responding to trigger words
 */
test(
    'MM-T617 deletes outgoing webhook and verifies it stops responding',
    {tag: ['@smoke', '@integrations']},
    async ({pw}) => {
        // # Register a custom response for this test
        const marker = 'MM-T617 webhook response';
        const callbackUrl = await registerOutgoingResponse({
            name: 'test-delete',
            response: {text: marker},
        });

        // # Create outgoing webhook
        const hook = await adminClient.createOutgoingWebhook({
            team_id: testTeam.id,
            display_name: 'Webhook to Delete',
            trigger_words: ['testing'],
            callback_urls: [callbackUrl],
        } as OutgoingWebhook);

        // # Log in and navigate
        const {channelsPage} = await pw.testBrowser.login(testUser);
        await channelsPage.goto(testTeam.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Post trigger word
        await channelsPage.postMessage('testing');

        // * Verify webhook responds with our marker
        const webhookPost = await channelsPage.getLastPost();
        await expect(webhookPost.container).toContainText(marker, {timeout: pw.duration.two_sec});

        // # Delete the webhook
        await adminClient.removeOutgoingWebhook(hook.id);

        // # Post trigger word again
        await channelsPage.postMessage('testing');
        await channelsPage.page.waitForTimeout(pw.duration.two_sec);

        // * Verify no webhook response
        const lastPost = await channelsPage.getLastPost();
        await expect(lastPost.container).not.toContainText(marker);
    },
);

/**
 * @objective Verify that disabling outgoing webhooks via config prevents responses, and re-enabling restores them
 */
test(
    'MM-T613 disables outgoing webhooks via config and verifies they stop responding',
    {tag: '@integrations'},
    async ({pw}) => {
        // # Register a custom response for this test
        const marker = 'MM-T613 webhook response';
        const callbackUrl = await registerOutgoingResponse({
            name: 'test-disable',
            response: {text: marker},
        });

        // # Create outgoing webhook
        await adminClient.createOutgoingWebhook({
            team_id: testTeam.id,
            display_name: 'Webhook to Disable',
            trigger_words: ['testing'],
            callback_urls: [callbackUrl],
        } as OutgoingWebhook);

        // # Log in and navigate
        const {channelsPage} = await pw.testBrowser.login(testUser);
        await channelsPage.goto(testTeam.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Confirm webhook works
        await channelsPage.postMessage('testing');
        const firstPost = await channelsPage.getLastPost();
        await expect(firstPost.container).toContainText(marker, {timeout: pw.duration.two_sec});

        // # Disable outgoing webhooks
        await adminClient.patchConfig({
            ServiceSettings: {EnableOutgoingWebhooks: false},
        });

        // # Post trigger word while disabled
        await channelsPage.postMessage('testing');
        await channelsPage.page.waitForTimeout(pw.duration.two_sec);

        // * Verify no webhook response
        const disabledPost = await channelsPage.getLastPost();
        await expect(disabledPost.container).not.toContainText(marker);

        // # Re-enable outgoing webhooks
        await adminClient.patchConfig({
            ServiceSettings: {EnableOutgoingWebhooks: true},
        });

        // # Post trigger word again
        await channelsPage.postMessage('testing');

        // * Verify webhook responds again
        const reEnabledPost = await channelsPage.getLastPost();
        await expect(reEnabledPost.container).toContainText(marker, {timeout: pw.duration.two_sec});
    },
);

/**
 * @objective Verify that regenerating an outgoing webhook token causes responses to include the new token
 */
test(
    'MM-T612 regenerates outgoing webhook token and verifies new token appears in responses',
    {tag: '@integrations'},
    async ({pw}) => {
        // # Create outgoing webhook using the built-in /outgoing which echoes token in response
        const hook = await adminClient.createOutgoingWebhook({
            team_id: testTeam.id,
            display_name: 'Webhook for Token Regen',
            trigger_words: ['testing'],
            callback_urls: [`${await requireWebhookServer()}/outgoing`],
        } as OutgoingWebhook);

        const originalToken = hook.token;
        expect(originalToken).toBeTruthy();

        // # Log in and navigate
        const {channelsPage} = await pw.testBrowser.login(testUser);
        await channelsPage.goto(testTeam.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Post trigger word
        await channelsPage.postMessage('testing');

        // * Verify response contains the original token
        const firstPost = await channelsPage.getLastPost();
        await expect(firstPost.container).toContainText(originalToken, {timeout: pw.duration.two_sec});

        // # Regenerate the token
        const regenerated = await adminClient.regenOutgoingHookToken(hook.id);
        const newToken = regenerated.token;
        expect(newToken).toBeTruthy();
        expect(newToken).not.toBe(originalToken);

        // # Post trigger word again
        await channelsPage.postMessage('testing');

        // * Verify response contains only the new token
        const secondPost = await channelsPage.getLastPost();
        await expect(secondPost.container).toContainText(newToken, {timeout: pw.duration.two_sec});
        await expect(secondPost.container).not.toContainText(originalToken);
    },
);
