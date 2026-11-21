// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    Api,
    expect,
    isWebhookTestServerReachable,
    settle,
    setupWebhookTestServer,
    test,
    testConfig,
} from '@mattermost/playwright-lib';

import {lastCenterPost, openThread, threadPostContaining} from './support';

async function postIncomingWebhook(webhookId: string, payload: Record<string, unknown>) {
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

test.describe('Interactive mm_blocks (incoming webhook)', () => {
    test(
        'external mm_blocks button block query overrides duplicate mm_blocks_actions query keys',
        {tag: ['@interactive_messages', '@mm_blocks', '@incoming_webhook', '@external_service']},
        async ({pw, request}) => {
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
                display_name: 'Playwright mm_blocks query override',
            });

            const integrationUrl = `${testConfig.webhookInternalUrl}/mm_blocks_integration_echo_query`;
            const marker = `E2E mm_blocks query override ${pw.random.id()}`;

            await postIncomingWebhook(webhook.id, {
                text: marker,
                props: {
                    mm_blocks: [
                        {
                            type: 'button',
                            text: 'Override dup key',
                            style: 'primary',
                            action_id: 'pw_mm_blocks_query_override',
                            query: {dup: 'from_block'},
                        },
                    ],
                    mm_blocks_actions: {
                        pw_mm_blocks_query_override: {
                            type: 'external',
                            url: integrationUrl,
                            query: {dup: 'from_action'},
                            context: {},
                        },
                    },
                },
            });

            const {app} = await pw.testBrowser.login(user);
            await app.channelsPage.goto({team, channel: 'town-square'});

            const lastPost = await lastCenterPost(app);
            const anchorPost = lastPost;
            await settle(anchorPost.blockAction('pw_mm_blocks_query_override'), {wait: Api.DoPostAction}).click();

            await openThread(app, anchorPost);
            await threadPostContaining(app, 'Playwright mm_blocks query OK (dup=from_block)');
        },
    );

    test(
        'external mm_blocks static_select merges action and element query on integration URL',
        {tag: ['@interactive_messages', '@mm_blocks', '@incoming_webhook', '@external_service']},
        async ({pw, request}) => {
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
                display_name: 'Playwright mm_blocks select query',
            });

            const integrationUrl = `${testConfig.webhookInternalUrl}/mm_blocks_integration_echo_query`;
            const marker = `E2E mm_blocks static_select query ${pw.random.id()}`;

            await postIncomingWebhook(webhook.id, {
                text: marker,
                props: {
                    mm_blocks: [
                        {type: 'text', text: 'Pick a region; the integration URL should include action + block query.'},
                        {
                            type: 'static_select',
                            action_id: 'pw_mm_blocks_static_select_query',
                            placeholder: 'Pick a region',
                            query: {cli: 'from_block'},
                            options: [
                                {text: 'North', value: 'opt_north'},
                                {text: 'South', value: 'opt_south'},
                            ],
                        },
                    ],
                    mm_blocks_actions: {
                        pw_mm_blocks_static_select_query: {
                            type: 'external',
                            url: integrationUrl,
                            query: {srv: 'from_action'},
                            context: {},
                        },
                    },
                },
            });

            const {app} = await pw.testBrowser.login(user);
            await app.channelsPage.goto({team, channel: 'town-square'});

            const lastPost = await lastCenterPost(app);
            const anchorPost = lastPost;

            await openThread(app, anchorPost);

            const rootInThread = await threadPostContaining(app, marker);
            await expect(rootInThread).toBeVisible();

            const regionSelectPicker = rootInThread.select({action_id: 'pw_mm_blocks_static_select_query'});
            const regionSelect = regionSelectPicker.valueTextbox;
            await expect(regionSelect).toBeVisible();
            await regionSelect.focus();
            await regionSelect.fill('Nor');
            await (await regionSelectPicker.suggestions.suggestionList.itemWith({text: 'North'})).select();
            await expect(regionSelectPicker.suggestions.suggestionList).toHaveKeyCount(0);

            const integrationEphemeral = await threadPostContaining(
                app,
                'Playwright mm_blocks query OK (cli=from_block&srv=from_action)',
            );
            await expect(integrationEphemeral.onlyVisibleToYouText).toBeVisible();
        },
    );

    test(
        'mm_blocks collapsible defaults to collapsed and toggles open and closed',
        {tag: ['@interactive_messages', '@mm_blocks', '@incoming_webhook']},
        async ({pw}) => {
            const {team, user, adminClient} = await pw.initSetup();

            const channels = await adminClient.getMyChannels(team.id);
            const townSquare = channels.find((ch) => ch.name === 'town-square');
            if (!townSquare) {
                throw new Error('Town Square channel not found');
            }

            const webhook = await adminClient.createIncomingWebhook({
                channel_id: townSquare.id,
                display_name: 'Playwright mm_blocks collapsible',
            });

            const marker = `E2E mm_blocks collapsible default ${pw.random.id()}`;
            const headerLabel = `PW collapsible header ${pw.random.id()}`;
            const bodyLabel = `PW collapsible body ${pw.random.id()}`;

            await postIncomingWebhook(webhook.id, {
                text: marker,
                props: {
                    mm_blocks: [
                        {
                            type: 'collapsible',
                            header: [{type: 'text', text: headerLabel}],
                            content: [{type: 'text', text: bodyLabel}],
                        },
                    ],
                },
            });

            const {app} = await pw.testBrowser.login(user);
            await app.channelsPage.goto({team, channel: 'town-square'});

            const lastPost = await lastCenterPost(app);

            const collapsible = lastPost.collapsible;
            await expect(collapsible).toBeVisible();

            // Chevron is the named toggle control; header text lives in a sibling region (layout_blocks.tsx).
            const toggle = lastPost.collapsible.toggleButton;
            const content = lastPost.collapsible.content;
            await expect(toggle).toBeVisible();
            await expect(collapsible).toBeVisible();
            await expect(collapsible).toContainText(headerLabel);
            await expect(toggle).toHaveAttribute('aria-expanded', 'false');
            // Collapsed body stays in the DOM for animation; visibility is via aria-hidden + max-height.
            await expect(content).toHaveAttribute('aria-hidden', 'true');

            await toggle.click();
            await expect(toggle).toHaveAttribute('aria-expanded', 'true');
            await expect(content).toHaveAttribute('aria-hidden', 'false');
            await expect(content).toBeVisible();
            await expect(content).toContainText(bodyLabel);

            await toggle.click();
            await expect(toggle).toHaveAttribute('aria-expanded', 'false');
            await expect(content).toHaveAttribute('aria-hidden', 'true');
        },
    );

    test(
        'mm_blocks collapsible with collapsed false starts expanded and toggles closed',
        {tag: ['@interactive_messages', '@mm_blocks', '@incoming_webhook']},
        async ({pw}) => {
            const {team, user, adminClient} = await pw.initSetup();

            const channels = await adminClient.getMyChannels(team.id);
            const townSquare = channels.find((ch) => ch.name === 'town-square');
            if (!townSquare) {
                throw new Error('Town Square channel not found');
            }

            const webhook = await adminClient.createIncomingWebhook({
                channel_id: townSquare.id,
                display_name: 'Playwright mm_blocks collapsible expanded',
            });

            const marker = `E2E mm_blocks collapsible expanded ${pw.random.id()}`;
            const headerLabel = `PW collapsible open header ${pw.random.id()}`;
            const bodyLabel = `PW collapsible open body ${pw.random.id()}`;

            await postIncomingWebhook(webhook.id, {
                text: marker,
                props: {
                    mm_blocks: [
                        {
                            type: 'collapsible',
                            collapsed: false,
                            header: [{type: 'text', text: headerLabel}],
                            content: [{type: 'text', text: bodyLabel}],
                        },
                    ],
                },
            });

            const {app} = await pw.testBrowser.login(user);
            await app.channelsPage.goto({team, channel: 'town-square'});

            const lastPost = await lastCenterPost(app);

            const collapsible = lastPost.collapsible;
            const toggle = lastPost.collapsible.toggleButton;
            const content = lastPost.collapsible.content;

            await expect(collapsible).toBeVisible();
            await expect(collapsible).toContainText(headerLabel);
            await expect(toggle).toHaveAttribute('aria-expanded', 'true');
            await expect(content).toHaveAttribute('aria-hidden', 'false');
            await expect(content).toBeVisible();
            await expect(content).toContainText(bodyLabel);

            await toggle.click();
            await expect(toggle).toHaveAttribute('aria-expanded', 'false');
            await expect(content).toHaveAttribute('aria-hidden', 'true');

            await toggle.click();
            await expect(toggle).toHaveAttribute('aria-expanded', 'true');
            await expect(content).toHaveAttribute('aria-hidden', 'false');
            await expect(content).toBeVisible();
            await expect(content).toContainText(bodyLabel);
        },
    );
});
