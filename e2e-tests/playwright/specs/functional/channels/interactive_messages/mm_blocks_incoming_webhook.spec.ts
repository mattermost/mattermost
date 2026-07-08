// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    expect,
    isWebhookTestServerReachable,
    setupWebhookTestServer,
    test,
    testConfig,
} from '@mattermost/playwright-lib';

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
        'renders mm_blocks payload without message text from an incoming webhook',
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
                display_name: 'Playwright mm_blocks no message text',
            });

            const blockText = `E2E mm_blocks without message ${pw.random.id()}`;

            await postIncomingWebhook(webhook.id, {
                props: {
                    mm_blocks: [{type: 'text', text: blockText}],
                },
            });

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const lastPost = await channelsPage.getLastPost();
            await lastPost.toBeVisible();
            await expect(lastPost.mmBlocks).toBeVisible();
            await expect(lastPost.container.getByText(blockText)).toBeVisible();
        },
    );

    test(
        'renders native mm_blocks payload from an incoming webhook',
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
                display_name: 'Playwright mm_blocks render',
            });

            await postIncomingWebhook(webhook.id, {
                text: 'E2E mm_blocks (native props)',
                props: {
                    mm_blocks: [
                        {type: 'text', text: 'Hello from **Playwright** mm_blocks.'},
                        {type: 'divider'},
                        {type: 'text', text: 'Second line after divider.'},
                    ],
                },
            });

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const lastPost = await channelsPage.getLastPost();
            await lastPost.toBeVisible();
            await expect(lastPost.mmBlocks).toBeVisible();
            await expect(lastPost.container.getByText('Second line after divider.')).toBeVisible();
        },
    );

    test(
        'mm_blocks disabled button is not enabled for interaction',
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
                display_name: 'Playwright mm_blocks disabled',
            });

            const marker = `E2E mm_blocks disabled ${pw.random.id()}`;

            await postIncomingWebhook(webhook.id, {
                text: marker,
                props: {
                    mm_blocks: [
                        {type: 'text', text: 'The following control must stay disabled.'},
                        {
                            type: 'button',
                            text: 'Disabled action',
                            style: 'primary',
                            action_id: 'pw_mm_blocks_disabled_inert',
                            disabled: true,
                        },
                    ],
                },
            });

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const lastPost = await channelsPage.getLastPost();
            await lastPost.toBeVisible();

            const disabledButton = lastPost.container.getByRole('button', {name: 'Disabled action'});
            await expect(disabledButton).toBeVisible();
            await expect(disabledButton).toBeDisabled();
        },
    );

    test(
        'mm_blocks omits malformed entries and keeps rendering valid blocks',
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
                display_name: 'Playwright mm_blocks malformed',
            });

            const id = pw.random.id();
            const marker = `E2E mm_blocks malformed ${id}`;
            const goodA = `MM_OK_A_${id}`;
            const goodB = `MM_OK_B_${id}`;
            const goodC = `MM_OK_C_${id}`;
            const goodD = `MM_OK_D_${id}`;

            const malformedBlocks: unknown[] = [
                {type: 'text', text: goodA},
                null,
                'not-a-block-object',
                {type: 'text', text: {nested: 'object-instead-of-string'}},
                {type: 'text', text: goodB},
                {type: 404},
                {type: 'unknown_block_kind', text: 'dropped'},
                {type: 'text', text: 'x', is_subtle: 'not-a-boolean'},
                {type: 'text', text: 'y', extra_field: true},
                {type: 'divider', invalid: 'extra-keys'},
                {type: 'container', content: 'string-instead-of-array'},
                {type: 'static_select', placeholder: 'p', options: {not: 'array'}},
                {
                    type: 'collapsible',
                    header: 'string-instead-of-array',
                    content: [{type: 'text', text: 'inner'}],
                },
                {type: 'button', text: 'missing action_id'},
                {type: 'image', url: 99999, alt_text: 'url-not-string'},
                {type: 'column_set', columns: 'not-array'},
                {type: 'column', items: 'not-array', width: 'auto'},
                {type: 'divider'},
                {type: 'text', text: goodC},
                {type: 'text', text: goodD},
            ];

            await postIncomingWebhook(webhook.id, {
                text: marker,
                props: {
                    mm_blocks: malformedBlocks,
                },
            });

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const lastPost = await channelsPage.getLastPost();
            await lastPost.toBeVisible();
            await expect(lastPost.mmBlocks).toBeVisible();

            await expect(lastPost.container.getByText(goodA)).toBeVisible();
            await expect(lastPost.container.getByText(goodB)).toBeVisible();
            await expect(lastPost.container.getByText(goodC)).toBeVisible();
            await expect(lastPost.container.getByText(goodD)).toBeVisible();

            await expect(lastPost.container.getByText('nested')).not.toBeVisible();
            await expect(lastPost.container.getByText('inner')).not.toBeVisible();
            await expect(lastPost.container.getByRole('button', {name: 'missing action_id'})).not.toBeVisible();
        },
    );

    test(
        'external mm_blocks button reaches webhook sidecar and shows ephemeral response',
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
                mattermostBaseUrl: testConfig.baseURL,
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
                display_name: 'Playwright mm_blocks integration',
            });

            const integrationUrl = `${testConfig.webhookBaseUrl}/mm_blocks_integration`;

            await postIncomingWebhook(webhook.id, {
                text: 'E2E mm_blocks external integration',
                props: {
                    mm_blocks: [
                        {type: 'text', text: 'Click the button to call the local webhook test server.'},
                        {
                            type: 'button',
                            text: 'Ping integration',
                            style: 'primary',
                            action_id: 'pw_mm_blocks_integration',
                        },
                    ],
                    mm_blocks_actions: {
                        pw_mm_blocks_integration: {
                            type: 'external',
                            url: integrationUrl,
                            context: {},
                        },
                    },
                },
            });

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const lastPost = await channelsPage.getLastPost();
            await lastPost.toBeVisible();
            await lastPost.container.getByRole('button', {name: 'Ping integration'}).click();

            // With Collapsed Reply Threads (CRT) on, integration ephemerals carry root_id and are not inserted into
            // the main channel post list (postsInChannel), so assert the ephemeral in the thread panel.
            // Do not rely on a "1 reply" summary: it may not get an accessible name for ephemeral-only children;
            // use the post's Reply control (matches the product UI and is locale-stable in en tests).
            await lastPost.hover();
            await expect(lastPost.postMenu.replyButton).toBeVisible();
            await lastPost.postMenu.replyButton.click();

            await channelsPage.sidebarRight.toBeVisible();

            const integrationEphemeral = await channelsPage.sidebarRight.getLastPost();
            await expect(
                integrationEphemeral.container.getByText('(Only visible to you)', {exact: true}),
            ).toBeVisible();
            await expect(
                integrationEphemeral.container.getByText(/Playwright mm_blocks integration OK \(user:/),
            ).toBeVisible();
        },
    );

    test(
        'external mm_blocks button applies integration update to webhook post',
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
                mattermostBaseUrl: testConfig.baseURL,
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
                display_name: 'Playwright mm_blocks update',
            });

            const integrationUrl = `${testConfig.webhookBaseUrl}/mm_blocks_integration_update`;

            await postIncomingWebhook(webhook.id, {
                text: 'E2E mm_blocks before apply update',
                props: {
                    mm_blocks: [
                        {type: 'text', text: 'Tap apply to run the update integration.'},
                        {
                            type: 'button',
                            text: 'Apply update',
                            style: 'primary',
                            action_id: 'pw_mm_blocks_apply_update',
                        },
                    ],
                    mm_blocks_actions: {
                        pw_mm_blocks_apply_update: {
                            type: 'external',
                            url: integrationUrl,
                            context: {},
                        },
                    },
                },
            });

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const lastPost = await channelsPage.getLastPost();
            await lastPost.toBeVisible();
            await lastPost.container.getByRole('button', {name: 'Apply update'}).click();

            await expect(lastPost.container.getByText('PLAYWRIGHT_MM_BLOCKS_UPDATED')).toBeVisible();
        },
    );

    test(
        'incoming webhook mm_blocks username override persists after integration update',
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
                mattermostBaseUrl: testConfig.baseURL,
                adminUsername: testConfig.adminUsername,
                adminPassword: testConfig.adminPassword,
            });

            const {team, user, adminClient} = await pw.initSetup();
            await adminClient.patchConfig({ServiceSettings: {EnablePostUsernameOverride: true}});

            const channels = await adminClient.getMyChannels(team.id);
            const townSquare = channels.find((ch) => ch.name === 'town-square');
            if (!townSquare) {
                throw new Error('Town Square channel not found');
            }

            const webhook = await adminClient.createIncomingWebhook({
                channel_id: townSquare.id,
                display_name: 'Playwright mm_blocks override author',
            });

            const overrideAuthorName = 'Playwright mm_blocks override';
            const marker = `E2E mm_blocks override author ${pw.random.id()}`;
            const integrationUrl = `${testConfig.webhookBaseUrl}/mm_blocks_integration_update`;

            await postIncomingWebhook(webhook.id, {
                username: overrideAuthorName,
                text: marker,
                props: {
                    mm_blocks: [
                        {type: 'text', text: 'Tap apply; author label must stay overridden.'},
                        {
                            type: 'button',
                            text: 'Apply update',
                            style: 'primary',
                            action_id: 'pw_mm_blocks_apply_update_override',
                        },
                    ],
                    mm_blocks_actions: {
                        pw_mm_blocks_apply_update_override: {
                            type: 'external',
                            url: integrationUrl,
                            context: {},
                        },
                    },
                },
            });

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const lastPost = await channelsPage.getLastPost();
            await lastPost.toBeVisible();

            await expect(lastPost.userPopover).toContainText(overrideAuthorName);

            await lastPost.container.getByRole('button', {name: 'Apply update'}).click();

            await expect(lastPost.container.getByText('PLAYWRIGHT_MM_BLOCKS_UPDATED')).toBeVisible();
            await expect(lastPost.userPopover).toContainText(overrideAuthorName);
        },
    );

    test(
        'external mm_blocks static_select sends selected_option to integration',
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
                mattermostBaseUrl: testConfig.baseURL,
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
                display_name: 'Playwright mm_blocks static_select',
            });

            const integrationUrl = `${testConfig.webhookBaseUrl}/mm_blocks_integration_static_select`;
            const marker = `E2E mm_blocks static_select ${pw.random.id()}`;

            await postIncomingWebhook(webhook.id, {
                text: marker,
                props: {
                    mm_blocks: [
                        {type: 'text', text: 'Choose a menu option to verify selected_option is POSTed.'},
                        {
                            type: 'static_select',
                            action_id: 'pw_mm_blocks_static_select',
                            placeholder: 'Pick a region',
                            options: [
                                {text: 'North', value: 'opt_north'},
                                {text: 'South', value: 'opt_south'},
                            ],
                        },
                    ],
                    mm_blocks_actions: {
                        pw_mm_blocks_static_select: {
                            type: 'external',
                            url: integrationUrl,
                            context: {},
                        },
                    },
                },
            });

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const lastPost = await channelsPage.getLastPost();
            await lastPost.toBeVisible();

            await lastPost.hover();
            await expect(lastPost.postMenu.replyButton).toBeVisible();
            await lastPost.postMenu.replyButton.click();

            await channelsPage.sidebarRight.toBeVisible();

            const rootInThread = await channelsPage.sidebarRight.getPostByText(marker);
            await rootInThread.toBeVisible();

            const regionSelect = rootInThread.container.getByRole('combobox', {name: 'Pick a region'});
            await expect(regionSelect).toBeVisible();
            await regionSelect.click();
            await regionSelect.fill('Sou');

            await channelsPage.selectOption('South');

            await channelsPage.sidebarRight.toContainText(
                'Playwright mm_blocks static_select OK (selected_option: opt_south)',
            );

            const integrationEphemeral = await channelsPage.sidebarRight.getLastPost();
            await integrationEphemeral.toBeVisible();
            await expect(
                integrationEphemeral.container.getByText('(Only visible to you)', {exact: true}),
            ).toBeVisible();
        },
    );

    test(
        'external mm_blocks static_select data_source users sends selected user id to integration',
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
                mattermostBaseUrl: testConfig.baseURL,
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
                display_name: 'Playwright mm_blocks static_select users',
            });

            const integrationUrl = `${testConfig.webhookBaseUrl}/mm_blocks_integration_static_select`;
            const marker = `E2E mm_blocks static_select users ${pw.random.id()}`;

            await postIncomingWebhook(webhook.id, {
                text: marker,
                props: {
                    mm_blocks: [
                        {type: 'text', text: 'Pick a user; selected_option should be the user id.'},
                        {
                            type: 'static_select',
                            action_id: 'pw_mm_blocks_ds_users',
                            placeholder: 'Pick a user',
                            data_source: 'users',
                        },
                    ],
                    mm_blocks_actions: {
                        pw_mm_blocks_ds_users: {
                            type: 'external',
                            url: integrationUrl,
                            context: {},
                        },
                    },
                },
            });

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const lastPost = await channelsPage.getLastPost();
            await lastPost.toBeVisible();

            await lastPost.hover();
            await expect(lastPost.postMenu.replyButton).toBeVisible();
            await lastPost.postMenu.replyButton.click();

            await channelsPage.sidebarRight.toBeVisible();

            const rootInThread = await channelsPage.sidebarRight.getPostByText(marker);
            await rootInThread.toBeVisible();

            const userSelect = rootInThread.container.getByRole('combobox', {name: 'Pick a user'});
            await expect(userSelect).toBeVisible();
            await userSelect.click();
            await userSelect.fill(user.username);
            await channelsPage.selectOption(`@${user.username}`);

            await channelsPage.sidebarRight.toContainText(
                `Playwright mm_blocks static_select OK (selected_option: ${user.id})`,
            );

            const integrationEphemeral = await channelsPage.sidebarRight.getLastPost();
            await integrationEphemeral.toBeVisible();
            await expect(
                integrationEphemeral.container.getByText('(Only visible to you)', {exact: true}),
            ).toBeVisible();
        },
    );

    test(
        'external mm_blocks static_select data_source channels sends selected channel id to integration',
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
                mattermostBaseUrl: testConfig.baseURL,
                adminUsername: testConfig.adminUsername,
                adminPassword: testConfig.adminPassword,
            });

            const {adminClient, team, user} = await pw.initSetup();

            const channels = await adminClient.getMyChannels(team.id);
            const townSquare = channels.find((ch) => ch.name === 'town-square');
            if (!townSquare) {
                throw new Error('Town Square channel not found');
            }

            const webhook = await adminClient.createIncomingWebhook({
                channel_id: townSquare.id,
                display_name: 'Playwright mm_blocks static_select channels',
            });

            const integrationUrl = `${testConfig.webhookBaseUrl}/mm_blocks_integration_static_select`;
            const marker = `E2E mm_blocks static_select channels ${pw.random.id()}`;

            await postIncomingWebhook(webhook.id, {
                text: marker,
                props: {
                    mm_blocks: [
                        {type: 'text', text: 'Pick a channel; selected_option should be the channel id.'},
                        {
                            type: 'static_select',
                            action_id: 'pw_mm_blocks_ds_channels',
                            placeholder: 'Pick a channel',
                            data_source: 'channels',
                        },
                    ],
                    mm_blocks_actions: {
                        pw_mm_blocks_ds_channels: {
                            type: 'external',
                            url: integrationUrl,
                            context: {},
                        },
                    },
                },
            });

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const lastPost = await channelsPage.getLastPost();
            await lastPost.toBeVisible();

            await lastPost.hover();
            await expect(lastPost.postMenu.replyButton).toBeVisible();
            await lastPost.postMenu.replyButton.click();

            await channelsPage.sidebarRight.toBeVisible();

            const rootInThread = await channelsPage.sidebarRight.getPostByText(marker);
            await rootInThread.toBeVisible();

            const channelSelect = rootInThread.container.getByRole('combobox', {name: 'Pick a channel'});
            await expect(channelSelect).toBeVisible();
            await channelSelect.click();
            await channelSelect.fill('Town');
            await channelsPage.selectOption('Town Square');

            await channelsPage.sidebarRight.toContainText(
                `Playwright mm_blocks static_select OK (selected_option: ${townSquare.id})`,
            );

            const integrationEphemeral = await channelsPage.sidebarRight.getLastPost();
            await integrationEphemeral.toBeVisible();
            await expect(
                integrationEphemeral.container.getByText('(Only visible to you)', {exact: true}),
            ).toBeVisible();
        },
    );

    test(
        'external mm_blocks button sends mm_blocks_actions context to integration',
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
                mattermostBaseUrl: testConfig.baseURL,
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
                display_name: 'Playwright mm_blocks context',
            });

            const contextMarker = `ctx_${pw.random.id()}`;
            const integrationUrl = `${testConfig.webhookBaseUrl}/mm_blocks_integration_echo_context`;
            const marker = `E2E mm_blocks action_context ${pw.random.id()}`;

            await postIncomingWebhook(webhook.id, {
                text: marker,
                props: {
                    mm_blocks: [
                        {
                            type: 'text',
                            text: 'Tap the button; the integration should receive mm_blocks_actions.context.',
                        },
                        {
                            type: 'button',
                            text: 'Verify context',
                            style: 'primary',
                            action_id: 'pw_mm_blocks_echo_ctx',
                        },
                    ],
                    mm_blocks_actions: {
                        pw_mm_blocks_echo_ctx: {
                            type: 'external',
                            url: integrationUrl,
                            context: {test_marker: contextMarker},
                        },
                    },
                },
            });

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const lastPost = await channelsPage.getLastPost();
            await lastPost.toBeVisible();
            const anchorPost = lastPost.container;
            await anchorPost.getByRole('button', {name: 'Verify context'}).click();

            await anchorPost.hover();
            await anchorPost.getByRole('button', {name: 'reply'}).click();

            await channelsPage.sidebarRight.toBeVisible();
            await channelsPage.sidebarRight.toContainText(
                `Playwright mm_blocks context OK (test_marker: ${contextMarker})`,
            );

            const integrationEphemeral = await channelsPage.sidebarRight.getLastPost();
            await integrationEphemeral.toBeVisible();
            await expect(
                integrationEphemeral.container.getByText('(Only visible to you)', {exact: true}),
            ).toBeVisible();
        },
    );

    test(
        'mm_blocks openURL action navigates with merged action query',
        {tag: ['@interactive_messages', '@mm_blocks', '@incoming_webhook']},
        async ({pw}) => {
            const {team, user, adminClient} = await pw.initSetup();

            const channels = await adminClient.getMyChannels(team.id);
            const townSquare = channels.find((ch) => ch.name === 'town-square');
            const offTopic = channels.find((ch) => ch.name === 'off-topic');
            if (!townSquare || !offTopic) {
                throw new Error('Town Square or Off-Topic channel not found');
            }

            const webhook = await adminClient.createIncomingWebhook({
                channel_id: townSquare.id,
                display_name: 'Playwright mm_blocks openURL',
            });

            const marker = `E2E mm_blocks openURL ${pw.random.id()}`;
            const targetChannelPath = `/${team.name}/channels/off-topic`;

            await postIncomingWebhook(webhook.id, {
                text: marker,
                props: {
                    mm_blocks: [
                        {type: 'text', text: 'Use the button to jump to Off-Topic via openURL.'},
                        {
                            type: 'button',
                            text: 'Go to Off-Topic',
                            style: 'primary',
                            action_id: 'pw_mm_blocks_openurl',
                        },
                    ],
                    mm_blocks_actions: {
                        pw_mm_blocks_openurl: {
                            type: 'openURL',
                            url: targetChannelPath,
                            query: {mm_openurl: 'from_action'},
                        },
                    },
                },
            });

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const lastPost = await channelsPage.getLastPost();
            await lastPost.toBeVisible();
            await lastPost.container.getByRole('button', {name: 'Go to Off-Topic'}).click();

            await expect(channelsPage.page).toHaveURL(/\/channels\/off-topic/);
            expect(new URL(channelsPage.page.url()).searchParams.get('mm_openurl')).toBe('from_action');
        },
    );

    test(
        'external mm_blocks button merges mm_blocks_actions query with block query on integration URL',
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
                mattermostBaseUrl: testConfig.baseURL,
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
                display_name: 'Playwright mm_blocks button query',
            });

            const integrationUrl = `${testConfig.webhookBaseUrl}/mm_blocks_integration_echo_query`;
            const marker = `E2E mm_blocks button query ${pw.random.id()}`;

            await postIncomingWebhook(webhook.id, {
                text: marker,
                props: {
                    mm_blocks: [
                        {
                            type: 'text',
                            text: 'Button merges action-level and block-level query into the integration URL.',
                        },
                        {
                            type: 'button',
                            text: 'Run query merge',
                            style: 'primary',
                            action_id: 'pw_mm_blocks_query_btn',
                            query: {cli: 'from_block'},
                        },
                    ],
                    mm_blocks_actions: {
                        pw_mm_blocks_query_btn: {
                            type: 'external',
                            url: integrationUrl,
                            query: {srv: 'from_action'},
                            context: {},
                        },
                    },
                },
            });

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const lastPost = await channelsPage.getLastPost();
            await lastPost.toBeVisible();
            const anchorPost = lastPost.container;
            await anchorPost.getByRole('button', {name: 'Run query merge'}).click();

            await anchorPost.hover();
            const replyOnRoot = anchorPost.getByRole('button', {name: 'reply'});
            await expect(replyOnRoot).toBeVisible();
            await replyOnRoot.click();

            await channelsPage.sidebarRight.toBeVisible();

            await channelsPage.sidebarRight.toContainText(
                'Playwright mm_blocks query OK (cli=from_block&srv=from_action)',
            );
            await channelsPage.sidebarRight.toContainText('(Only visible to you)');
        },
    );

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
                mattermostBaseUrl: testConfig.baseURL,
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

            const integrationUrl = `${testConfig.webhookBaseUrl}/mm_blocks_integration_echo_query`;
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

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const lastPost = await channelsPage.getLastPost();
            await lastPost.toBeVisible();
            const anchorPost = lastPost.container;
            await anchorPost.getByRole('button', {name: 'Override dup key'}).click();

            await anchorPost.hover();
            await anchorPost.getByRole('button', {name: 'reply'}).click();

            await channelsPage.sidebarRight.toBeVisible();
            await channelsPage.sidebarRight.toContainText('Playwright mm_blocks query OK (dup=from_block)');
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
                mattermostBaseUrl: testConfig.baseURL,
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

            const integrationUrl = `${testConfig.webhookBaseUrl}/mm_blocks_integration_echo_query`;
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

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const lastPost = await channelsPage.getLastPost();
            await lastPost.toBeVisible();

            await lastPost.hover();
            await expect(lastPost.postMenu.replyButton).toBeVisible();
            await lastPost.postMenu.replyButton.click();

            await channelsPage.sidebarRight.toBeVisible();

            const rootInThread = await channelsPage.sidebarRight.getPostByText(marker);
            await rootInThread.toBeVisible();

            const regionSelect = rootInThread.container.getByRole('combobox', {name: 'Pick a region'});
            await expect(regionSelect).toBeVisible();
            await regionSelect.click();
            await regionSelect.fill('Nor');
            await channelsPage.selectOption('North');

            await channelsPage.sidebarRight.toContainText(
                'Playwright mm_blocks query OK (cli=from_block&srv=from_action)',
            );
            await channelsPage.sidebarRight.toContainText('(Only visible to you)');
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

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const lastPost = await channelsPage.getLastPost();
            await lastPost.toBeVisible();

            const collapsible = lastPost.collapsible;
            await expect(collapsible.container).toBeVisible();

            const toggle = collapsible.toggle;
            const content = collapsible.content;
            await expect(toggle).toBeVisible();
            await expect(collapsible.container.getByText(headerLabel)).toBeVisible();
            await expect(toggle).toHaveAttribute('aria-expanded', 'false');
            await expect(content).toHaveAttribute('aria-hidden', 'true');

            await toggle.click();
            await expect(toggle).toHaveAttribute('aria-expanded', 'true');
            await expect(content).toHaveAttribute('aria-hidden', 'false');
            await expect(collapsible.container.getByText(bodyLabel)).toBeVisible();

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

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const lastPost = await channelsPage.getLastPost();
            await lastPost.toBeVisible();

            const collapsible = lastPost.collapsible;
            const toggle = collapsible.toggle;
            const content = collapsible.content;

            await expect(collapsible.container.getByText(headerLabel)).toBeVisible();
            await expect(toggle).toHaveAttribute('aria-expanded', 'true');
            await expect(content).toHaveAttribute('aria-hidden', 'false');
            await expect(collapsible.container.getByText(bodyLabel)).toBeVisible();

            await toggle.click();
            await expect(toggle).toHaveAttribute('aria-expanded', 'false');
            await expect(content).toHaveAttribute('aria-hidden', 'true');

            await toggle.click();
            await expect(toggle).toHaveAttribute('aria-expanded', 'true');
            await expect(content).toHaveAttribute('aria-hidden', 'false');
            await expect(collapsible.container.getByText(bodyLabel)).toBeVisible();
        },
    );
});
