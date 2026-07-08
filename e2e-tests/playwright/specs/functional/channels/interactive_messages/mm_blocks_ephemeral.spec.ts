// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    expect,
    isWebhookTestServerReachable,
    setupWebhookTestServer,
    test,
    testConfig,
} from '@mattermost/playwright-lib';

test.describe('Interactive mm_blocks (ephemeral post)', () => {
    test(
        'renders mm_blocks in an ephemeral post created via API',
        {tag: ['@interactive_messages', '@mm_blocks', '@ephemeral']},
        async ({pw}) => {
            const {team, user, adminClient} = await pw.initSetup();

            const channels = await adminClient.getMyChannels(team.id);
            const townSquare = channels.find((ch) => ch.name === 'town-square');
            if (!townSquare) {
                throw new Error('Town Square channel not found');
            }

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const marker = `E2E mm_blocks ephemeral ${pw.random.id()}`;

            await adminClient.createPostEphemeral(user.id, {
                channel_id: townSquare.id,
                message: 'E2E mm_blocks (ephemeral)',
                props: {
                    mm_blocks: [
                        {type: 'text', text: marker},
                        {type: 'divider'},
                        {type: 'text', text: 'Second line after divider.'},
                    ],
                },
            });

            const lastPost = await channelsPage.getLastPost();
            await lastPost.toBeVisible();
            await expect(lastPost.container.getByText('(Only visible to you)', {exact: true})).toBeVisible();
            await expect(lastPost.mmBlocks).toBeVisible();
            await expect(lastPost.container.getByText(marker)).toBeVisible();
            await expect(lastPost.container.getByText('Second line after divider.')).toBeVisible();
        },
    );

    test(
        'ephemeral mm_blocks external action reaches webhook sidecar and shows integration ephemeral',
        {tag: ['@interactive_messages', '@mm_blocks', '@ephemeral', '@external_service']},
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

            const {team, user, adminClient, userClient} = await pw.initSetup();

            const channels = await adminClient.getMyChannels(team.id);
            const townSquare = channels.find((ch) => ch.name === 'town-square');
            if (!townSquare) {
                throw new Error('Town Square channel not found');
            }

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            // Ephemeral roots have no Reply control; under CRT, integration ephemerals stay out of the center list.
            // Thread the interactive ephemeral under a normal channel post so the Thread panel can host it and the follow-up ephemeral.
            const anchorMarker = `E2E mm_blocks anchor ${pw.random.id()}`;
            const anchor = await userClient.createPost({
                channel_id: townSquare.id,
                message: anchorMarker,
            });

            const ephemeralMarker = `E2E mm_blocks ephemeral action ${pw.random.id()}`;
            const integrationUrl = `${testConfig.webhookBaseUrl}/mm_blocks_integration`;

            await adminClient.createPostEphemeral(user.id, {
                channel_id: townSquare.id,
                root_id: anchor.id,
                message: 'E2E mm_blocks (ephemeral + external action)',
                props: {
                    mm_blocks: [
                        {type: 'text', text: ephemeralMarker},
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

            const lastPost = await channelsPage.getLastPost();
            await lastPost.toBeVisible();
            await lastPost.hover();
            await expect(lastPost.postMenu.replyButton).toBeVisible();
            await lastPost.postMenu.replyButton.click();

            await channelsPage.sidebarRight.toBeVisible();

            const ephemeralInThread = await channelsPage.sidebarRight.getPostByText(ephemeralMarker);
            await ephemeralInThread.toBeVisible();
            await ephemeralInThread.container.getByRole('button', {name: 'Ping integration'}).click();

            await expect(channelsPage.sidebarRight.container).toContainText(
                /Playwright mm_blocks integration OK \(user:/,
            );

            const integrationEphemeral = await channelsPage.sidebarRight.getLastPost();
            await integrationEphemeral.toBeVisible();
            await expect(
                integrationEphemeral.container.getByText('(Only visible to you)', {exact: true}),
            ).toBeVisible();
        },
    );

    test(
        'ephemeral mm_blocks external action applies integration update in thread',
        {tag: ['@interactive_messages', '@mm_blocks', '@ephemeral', '@external_service']},
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

            const {team, user, adminClient, userClient} = await pw.initSetup();

            const channels = await adminClient.getMyChannels(team.id);
            const townSquare = channels.find((ch) => ch.name === 'town-square');
            if (!townSquare) {
                throw new Error('Town Square channel not found');
            }

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const anchorMarker = `E2E mm_blocks anchor ${pw.random.id()}`;
            const anchor = await userClient.createPost({
                channel_id: townSquare.id,
                message: anchorMarker,
            });

            const ephemeralMarker = `E2E mm_blocks ephemeral update ${pw.random.id()}`;
            const integrationUrl = `${testConfig.webhookBaseUrl}/mm_blocks_integration_update`;

            await adminClient.createPostEphemeral(user.id, {
                channel_id: townSquare.id,
                root_id: anchor.id,
                message: 'E2E mm_blocks (ephemeral + apply update)',
                props: {
                    mm_blocks: [
                        {type: 'text', text: ephemeralMarker},
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

            const lastPost = await channelsPage.getLastPost();
            await lastPost.toBeVisible();
            await lastPost.hover();
            await expect(lastPost.postMenu.replyButton).toBeVisible();
            await lastPost.postMenu.replyButton.click();

            await channelsPage.sidebarRight.toBeVisible();

            const ephemeralInThread = await channelsPage.sidebarRight.getPostByText(ephemeralMarker);
            await ephemeralInThread.toBeVisible();
            await ephemeralInThread.container.getByRole('button', {name: 'Apply update'}).click();

            const updated = await channelsPage.sidebarRight.getPostByText('PLAYWRIGHT_MM_BLOCKS_UPDATED');
            await updated.toBeVisible();
        },
    );

    test(
        'ephemeral mm_blocks username override persists after integration update in thread',
        {tag: ['@interactive_messages', '@mm_blocks', '@ephemeral', '@external_service']},
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

            const {team, user, adminClient, userClient} = await pw.initSetup();
            await adminClient.patchConfig({ServiceSettings: {EnablePostUsernameOverride: true}});

            const channels = await adminClient.getMyChannels(team.id);
            const townSquare = channels.find((ch) => ch.name === 'town-square');
            if (!townSquare) {
                throw new Error('Town Square channel not found');
            }

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const anchorMarker = `E2E mm_blocks anchor override ${pw.random.id()}`;
            const anchor = await userClient.createPost({
                channel_id: townSquare.id,
                message: anchorMarker,
            });

            const overrideAuthorName = 'Playwright mm_blocks eph override';
            const ephemeralMarker = `E2E mm_blocks ephemeral override ${pw.random.id()}`;
            const integrationUrl = `${testConfig.webhookBaseUrl}/mm_blocks_integration_update`;

            await adminClient.createPostEphemeral(user.id, {
                channel_id: townSquare.id,
                root_id: anchor.id,
                message: 'E2E mm_blocks (ephemeral + override + apply update)',
                props: {
                    from_webhook: 'true',
                    override_username: overrideAuthorName,
                    mm_blocks: [
                        {type: 'text', text: ephemeralMarker},
                        {
                            type: 'button',
                            text: 'Apply update',
                            style: 'primary',
                            action_id: 'pw_mm_blocks_apply_update_eph_override',
                        },
                    ],
                    mm_blocks_actions: {
                        pw_mm_blocks_apply_update_eph_override: {
                            type: 'external',
                            url: integrationUrl,
                            context: {},
                        },
                    },
                },
            });

            const lastPost = await channelsPage.getLastPost();
            await lastPost.toBeVisible();
            await lastPost.hover();
            await expect(lastPost.postMenu.replyButton).toBeVisible();
            await lastPost.postMenu.replyButton.click();

            await channelsPage.sidebarRight.toBeVisible();

            const ephemeralInThread = await channelsPage.sidebarRight.getPostByText(ephemeralMarker);
            await ephemeralInThread.toBeVisible();

            await expect(ephemeralInThread.userPopover).toContainText(overrideAuthorName);

            await ephemeralInThread.container.getByRole('button', {name: 'Apply update'}).click();

            const updated = await channelsPage.sidebarRight.getPostByText('PLAYWRIGHT_MM_BLOCKS_UPDATED');
            await updated.toBeVisible();
            await expect(updated.userPopover).toContainText(overrideAuthorName);
        },
    );

    test(
        'ephemeral mm_blocks button merges mm_blocks_actions query with block query on integration URL',
        {tag: ['@interactive_messages', '@mm_blocks', '@ephemeral', '@external_service']},
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

            const {team, user, adminClient, userClient} = await pw.initSetup();

            const channels = await adminClient.getMyChannels(team.id);
            const townSquare = channels.find((ch) => ch.name === 'town-square');
            if (!townSquare) {
                throw new Error('Town Square channel not found');
            }

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const anchorMarker = `E2E mm_blocks eph query anchor ${pw.random.id()}`;
            const anchor = await userClient.createPost({
                channel_id: townSquare.id,
                message: anchorMarker,
            });

            const ephemeralMarker = `E2E mm_blocks eph query merge ${pw.random.id()}`;
            const integrationUrl = `${testConfig.webhookBaseUrl}/mm_blocks_integration_echo_query`;

            await adminClient.createPostEphemeral(user.id, {
                channel_id: townSquare.id,
                root_id: anchor.id,
                message: 'E2E mm_blocks (ephemeral + query merge)',
                props: {
                    mm_blocks: [
                        {type: 'text', text: ephemeralMarker},
                        {
                            type: 'button',
                            text: 'Run query merge',
                            style: 'primary',
                            action_id: 'pw_mm_blocks_query_btn_eph',
                            query: {cli: 'from_block'},
                        },
                    ],
                    mm_blocks_actions: {
                        pw_mm_blocks_query_btn_eph: {
                            type: 'external',
                            url: integrationUrl,
                            query: {srv: 'from_action'},
                            context: {},
                        },
                    },
                },
            });

            const lastPost = await channelsPage.getLastPost();
            await lastPost.toBeVisible();
            await lastPost.hover();
            await lastPost.postMenu.replyButton.click();

            await channelsPage.sidebarRight.toBeVisible();

            const ephemeralInThread = await channelsPage.sidebarRight.getPostByText(ephemeralMarker);
            await ephemeralInThread.toBeVisible();
            await ephemeralInThread.container.getByRole('button', {name: 'Run query merge'}).click();

            await channelsPage.sidebarRight.toContainText(
                'Playwright mm_blocks query OK (cli=from_block&srv=from_action)',
            );

            const integrationEphemeral = await channelsPage.sidebarRight.getLastPost();
            await integrationEphemeral.toBeVisible();
            await expect(
                integrationEphemeral.container.getByText('(Only visible to you)', {exact: true}),
            ).toBeVisible();
        },
    );

    test(
        'ephemeral mm_blocks button block query overrides duplicate mm_blocks_actions query keys',
        {tag: ['@interactive_messages', '@mm_blocks', '@ephemeral', '@external_service']},
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

            const {team, user, adminClient, userClient} = await pw.initSetup();

            const channels = await adminClient.getMyChannels(team.id);
            const townSquare = channels.find((ch) => ch.name === 'town-square');
            if (!townSquare) {
                throw new Error('Town Square channel not found');
            }

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const anchorMarker = `E2E mm_blocks eph override anchor ${pw.random.id()}`;
            const anchor = await userClient.createPost({
                channel_id: townSquare.id,
                message: anchorMarker,
            });

            const ephemeralMarker = `E2E mm_blocks eph query override ${pw.random.id()}`;
            const integrationUrl = `${testConfig.webhookBaseUrl}/mm_blocks_integration_echo_query`;

            await adminClient.createPostEphemeral(user.id, {
                channel_id: townSquare.id,
                root_id: anchor.id,
                message: 'E2E mm_blocks (ephemeral + query override)',
                props: {
                    mm_blocks: [
                        {type: 'text', text: ephemeralMarker},
                        {
                            type: 'button',
                            text: 'Override dup key',
                            style: 'primary',
                            action_id: 'pw_mm_blocks_query_override_eph',
                            query: {dup: 'from_block'},
                        },
                    ],
                    mm_blocks_actions: {
                        pw_mm_blocks_query_override_eph: {
                            type: 'external',
                            url: integrationUrl,
                            query: {dup: 'from_action'},
                            context: {},
                        },
                    },
                },
            });

            const lastPost = await channelsPage.getLastPost();
            await lastPost.toBeVisible();
            await lastPost.hover();
            await lastPost.postMenu.replyButton.click();

            await channelsPage.sidebarRight.toBeVisible();

            const ephemeralInThread = await channelsPage.sidebarRight.getPostByText(ephemeralMarker);
            await ephemeralInThread.toBeVisible();
            await ephemeralInThread.container.getByRole('button', {name: 'Override dup key'}).click();

            await channelsPage.sidebarRight.toContainText('Playwright mm_blocks query OK (dup=from_block)');
        },
    );

    test(
        'ephemeral mm_blocks static_select merges action and element query on integration URL',
        {tag: ['@interactive_messages', '@mm_blocks', '@ephemeral', '@external_service']},
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

            const {team, user, adminClient, userClient} = await pw.initSetup();

            const channels = await adminClient.getMyChannels(team.id);
            const townSquare = channels.find((ch) => ch.name === 'town-square');
            if (!townSquare) {
                throw new Error('Town Square channel not found');
            }

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const anchorMarker = `E2E mm_blocks eph select query anchor ${pw.random.id()}`;
            const anchor = await userClient.createPost({
                channel_id: townSquare.id,
                message: anchorMarker,
            });

            const ephemeralMarker = `E2E mm_blocks eph static_select query ${pw.random.id()}`;
            const integrationUrl = `${testConfig.webhookBaseUrl}/mm_blocks_integration_echo_query`;

            await adminClient.createPostEphemeral(user.id, {
                channel_id: townSquare.id,
                root_id: anchor.id,
                message: 'E2E mm_blocks (ephemeral + static_select query)',
                props: {
                    mm_blocks: [
                        {type: 'text', text: ephemeralMarker},
                        {
                            type: 'static_select',
                            action_id: 'pw_mm_blocks_static_select_query_eph',
                            placeholder: 'Pick a region',
                            query: {cli: 'from_block'},
                            options: [
                                {text: 'North', value: 'opt_north'},
                                {text: 'South', value: 'opt_south'},
                            ],
                        },
                    ],
                    mm_blocks_actions: {
                        pw_mm_blocks_static_select_query_eph: {
                            type: 'external',
                            url: integrationUrl,
                            query: {srv: 'from_action'},
                            context: {},
                        },
                    },
                },
            });

            const lastPost = await channelsPage.getLastPost();
            await lastPost.toBeVisible();
            await lastPost.hover();
            await lastPost.postMenu.replyButton.click();

            await channelsPage.sidebarRight.toBeVisible();

            const ephemeralRow = await channelsPage.sidebarRight.getPostByText(ephemeralMarker);
            await ephemeralRow.toBeVisible();

            const regionSelect = ephemeralRow.container.getByRole('combobox', {name: 'Pick a region'});
            await expect(regionSelect).toBeVisible();
            await regionSelect.click();
            await regionSelect.fill('Nor');
            await channelsPage.selectOption('North');

            await channelsPage.sidebarRight.toContainText(
                'Playwright mm_blocks query OK (cli=from_block&srv=from_action)',
            );

            const integrationEphemeral = await channelsPage.sidebarRight.getLastPost();
            await integrationEphemeral.toBeVisible();
            await expect(
                integrationEphemeral.container.getByText('(Only visible to you)', {exact: true}),
            ).toBeVisible();
        },
    );

    test(
        'ephemeral mm_blocks static_select data_source users sends selected user id to integration',
        {tag: ['@interactive_messages', '@mm_blocks', '@ephemeral', '@external_service']},
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

            const {team, user, adminClient, userClient} = await pw.initSetup();

            const channels = await adminClient.getMyChannels(team.id);
            const townSquare = channels.find((ch) => ch.name === 'town-square');
            if (!townSquare) {
                throw new Error('Town Square channel not found');
            }

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const anchorMarker = `E2E mm_blocks eph ds users anchor ${pw.random.id()}`;
            const anchor = await userClient.createPost({
                channel_id: townSquare.id,
                message: anchorMarker,
            });

            const ephemeralMarker = `E2E mm_blocks eph static_select users ${pw.random.id()}`;
            const integrationUrl = `${testConfig.webhookBaseUrl}/mm_blocks_integration_static_select`;

            await adminClient.createPostEphemeral(user.id, {
                channel_id: townSquare.id,
                root_id: anchor.id,
                message: 'E2E mm_blocks (ephemeral + static_select users)',
                props: {
                    mm_blocks: [
                        {type: 'text', text: ephemeralMarker},
                        {
                            type: 'static_select',
                            action_id: 'pw_mm_blocks_ds_users_eph',
                            placeholder: 'Pick a user',
                            data_source: 'users',
                        },
                    ],
                    mm_blocks_actions: {
                        pw_mm_blocks_ds_users_eph: {
                            type: 'external',
                            url: integrationUrl,
                            context: {},
                        },
                    },
                },
            });

            const lastPost = await channelsPage.getLastPost();
            await lastPost.toBeVisible();
            await lastPost.hover();
            await lastPost.postMenu.replyButton.click();

            await channelsPage.sidebarRight.toBeVisible();

            const ephemeralRow = await channelsPage.sidebarRight.getPostByText(ephemeralMarker);
            await ephemeralRow.toBeVisible();

            const userSelect = ephemeralRow.container.getByRole('combobox', {name: 'Pick a user'});
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
        'ephemeral mm_blocks static_select data_source channels sends selected channel id to integration',
        {tag: ['@interactive_messages', '@mm_blocks', '@ephemeral', '@external_service']},
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

            const {team, user, adminClient, userClient} = await pw.initSetup();

            const channels = await adminClient.getMyChannels(team.id);
            const townSquare = channels.find((ch) => ch.name === 'town-square');
            if (!townSquare) {
                throw new Error('Town Square channel not found');
            }

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const anchorMarker = `E2E mm_blocks eph ds channels anchor ${pw.random.id()}`;
            const anchor = await userClient.createPost({
                channel_id: townSquare.id,
                message: anchorMarker,
            });

            const ephemeralMarker = `E2E mm_blocks eph static_select channels ${pw.random.id()}`;
            const integrationUrl = `${testConfig.webhookBaseUrl}/mm_blocks_integration_static_select`;

            await adminClient.createPostEphemeral(user.id, {
                channel_id: townSquare.id,
                root_id: anchor.id,
                message: 'E2E mm_blocks (ephemeral + static_select channels)',
                props: {
                    mm_blocks: [
                        {type: 'text', text: ephemeralMarker},
                        {
                            type: 'static_select',
                            action_id: 'pw_mm_blocks_ds_channels_eph',
                            placeholder: 'Pick a channel',
                            data_source: 'channels',
                        },
                    ],
                    mm_blocks_actions: {
                        pw_mm_blocks_ds_channels_eph: {
                            type: 'external',
                            url: integrationUrl,
                            context: {},
                        },
                    },
                },
            });

            const lastPost = await channelsPage.getLastPost();
            await lastPost.toBeVisible();
            await lastPost.hover();
            await lastPost.postMenu.replyButton.click();

            await channelsPage.sidebarRight.toBeVisible();

            const ephemeralRow = await channelsPage.sidebarRight.getPostByText(ephemeralMarker);
            await ephemeralRow.toBeVisible();

            const channelSelect = ephemeralRow.container.getByRole('combobox', {name: 'Pick a channel'});
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
        'ephemeral mm_blocks button sends mm_blocks_actions context to integration',
        {tag: ['@interactive_messages', '@mm_blocks', '@ephemeral', '@external_service']},
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

            const {team, user, adminClient, userClient} = await pw.initSetup();

            const channels = await adminClient.getMyChannels(team.id);
            const townSquare = channels.find((ch) => ch.name === 'town-square');
            if (!townSquare) {
                throw new Error('Town Square channel not found');
            }

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const anchorMarker = `E2E mm_blocks eph context anchor ${pw.random.id()}`;
            const anchor = await userClient.createPost({
                channel_id: townSquare.id,
                message: anchorMarker,
            });

            const contextMarker = `ctx_${pw.random.id()}`;
            const ephemeralMarker = `E2E mm_blocks eph action_context ${pw.random.id()}`;
            const integrationUrl = `${testConfig.webhookBaseUrl}/mm_blocks_integration_echo_context`;

            await adminClient.createPostEphemeral(user.id, {
                channel_id: townSquare.id,
                root_id: anchor.id,
                message: 'E2E mm_blocks (ephemeral + action context)',
                props: {
                    mm_blocks: [
                        {type: 'text', text: ephemeralMarker},
                        {
                            type: 'button',
                            text: 'Verify context',
                            style: 'primary',
                            action_id: 'pw_mm_blocks_echo_ctx_eph',
                        },
                    ],
                    mm_blocks_actions: {
                        pw_mm_blocks_echo_ctx_eph: {
                            type: 'external',
                            url: integrationUrl,
                            context: {test_marker: contextMarker},
                        },
                    },
                },
            });

            const lastPost = await channelsPage.getLastPost();
            await lastPost.toBeVisible();
            await lastPost.hover();
            await lastPost.postMenu.replyButton.click();

            await channelsPage.sidebarRight.toBeVisible();

            const ephemeralInThread = await channelsPage.sidebarRight.getPostByText(ephemeralMarker);
            await ephemeralInThread.toBeVisible();
            await ephemeralInThread.container.getByRole('button', {name: 'Verify context'}).click();

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
        'ephemeral mm_blocks openURL action navigates with merged action query',
        {tag: ['@interactive_messages', '@mm_blocks', '@ephemeral']},
        async ({pw}) => {
            const {team, user, adminClient, userClient} = await pw.initSetup();

            const channels = await adminClient.getMyChannels(team.id);
            const townSquare = channels.find((ch) => ch.name === 'town-square');
            const offTopic = channels.find((ch) => ch.name === 'off-topic');
            if (!townSquare || !offTopic) {
                throw new Error('Town Square or Off-Topic channel not found');
            }

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const anchorMarker = `E2E mm_blocks eph openurl anchor ${pw.random.id()}`;
            const anchor = await userClient.createPost({
                channel_id: townSquare.id,
                message: anchorMarker,
            });

            const ephemeralMarker = `E2E mm_blocks eph openurl ${pw.random.id()}`;
            const targetChannelPath = `/${team.name}/channels/off-topic`;

            await adminClient.createPostEphemeral(user.id, {
                channel_id: townSquare.id,
                root_id: anchor.id,
                message: 'E2E mm_blocks (ephemeral + openURL)',
                props: {
                    mm_blocks: [
                        {type: 'text', text: ephemeralMarker},
                        {
                            type: 'button',
                            text: 'Go to Off-Topic',
                            style: 'primary',
                            action_id: 'pw_mm_blocks_openurl_eph',
                        },
                    ],
                    mm_blocks_actions: {
                        pw_mm_blocks_openurl_eph: {
                            type: 'openURL',
                            url: targetChannelPath,
                            query: {mm_openurl: 'from_action_eph'},
                        },
                    },
                },
            });

            const lastPost = await channelsPage.getLastPost();
            await lastPost.toBeVisible();
            await lastPost.hover();
            await lastPost.postMenu.replyButton.click();

            await channelsPage.sidebarRight.toBeVisible();

            const ephemeralInThread = await channelsPage.sidebarRight.getPostByText(ephemeralMarker);
            await ephemeralInThread.toBeVisible();
            await ephemeralInThread.container.getByRole('button', {name: 'Go to Off-Topic'}).click();

            await expect(channelsPage.page).toHaveURL(/\/channels\/off-topic/);
            expect(new URL(channelsPage.page.url()).searchParams.get('mm_openurl')).toBe('from_action_eph');
        },
    );
});
