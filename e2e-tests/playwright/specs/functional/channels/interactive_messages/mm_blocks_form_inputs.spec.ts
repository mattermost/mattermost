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

test.describe('Interactive mm_blocks (form inputs)', () => {
    test(
        'mm_blocks form inputs render in a post',
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
                display_name: 'Playwright mm_blocks form inputs render',
            });

            const marker = `E2E mm_blocks form inputs render ${pw.random.id()}`;

            await postIncomingWebhook(webhook.id, {
                text: marker,
                props: {
                    mm_blocks: [
                        {
                            type: 'text_input',
                            name: 'title',
                            label: 'Title',
                            placeholder: 'Short summary',
                            initial_value: 'Sample ticket',
                            help_text: 'Title help',
                        },
                        {
                            type: 'text_input',
                            name: 'notes',
                            label: 'Notes',
                            optional: true,
                            multiline: true,
                            placeholder: 'Anything else?',
                        },
                        {
                            type: 'text_input',
                            name: 'locked_title',
                            label: 'Locked title',
                            disabled: true,
                            initial_value: 'read only',
                        },
                        {
                            type: 'bool_input',
                            name: 'notify_email',
                            label: 'Email notifications',
                            placeholder: 'Send me status updates by email',
                            initial_value: true,
                            help_text: 'Notify help',
                        },
                        {
                            type: 'bool_input',
                            name: 'subscribe_digest',
                            label: 'Weekly digest',
                            placeholder: 'Include this ticket in the weekly digest',
                            optional: true,
                        },
                        {
                            type: 'bool_input',
                            name: 'locked_notify',
                            label: 'Locked notify',
                            placeholder: 'Cannot change',
                            disabled: true,
                        },
                        {
                            type: 'select',
                            name: 'priority',
                            label: 'Priority',
                            placeholder: 'Choose priority',
                            style: 'compact',
                            initial_option: 'medium',
                            options: [
                                {text: 'Low', value: 'low'},
                                {text: 'Medium', value: 'medium'},
                                {text: 'High', value: 'high'},
                            ],
                        },
                        {
                            type: 'select',
                            name: 'severity',
                            label: 'Severity',
                            style: 'expanded',
                            initial_option: 'sev2',
                            options: [
                                {text: 'SEV-1', value: 'sev1'},
                                {text: 'SEV-2', value: 'sev2'},
                            ],
                        },
                        {
                            type: 'date_input',
                            name: 'due',
                            label: 'Due date',
                            placeholder: 'Pick a due date',
                            initial_value: '2025-01-10',
                            help_text: 'Due date help',
                        },
                        {
                            type: 'date_input',
                            name: 'optional_due',
                            label: 'Optional due',
                            optional: true,
                        },
                        {
                            type: 'date_input',
                            name: 'unlabeled_due',
                            label: '',
                        },
                        {
                            type: 'datetime_input',
                            name: 'meeting',
                            label: 'Meeting time',
                            placeholder: 'Pick meeting time',
                            help_text: 'Meeting help',
                        },
                        {
                            type: 'file_input',
                            name: 'attachments',
                            label: 'Attachments',
                            placeholder: 'Upload evidence',
                            help_text: 'File help',
                        },
                        {
                            type: 'file_input',
                            name: 'locked_files',
                            label: 'Locked files',
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
            await expect(lastPost.container.locator('.mm-blocks')).toBeVisible();

            // Prefer exact/anchored matches — substring "Title" also matches "Locked title".
            const titleInput = lastPost.container.locator('.mm-blocks-text-input').filter({hasText: /^Title/});
            await expect(titleInput).toBeVisible();
            await expect(titleInput.locator('span.error-text')).toBeVisible();
            await expect(titleInput.getByText('Title help')).toBeVisible();
            await expect(titleInput.getByTestId('titleinput')).toHaveValue('Sample ticket');

            const notesInput = lastPost.container.locator('.mm-blocks-text-input').filter({hasText: /^Notes/});
            await expect(notesInput.getByText('(optional)')).toBeVisible();
            await expect(notesInput.getByTestId('notesinput')).toBeVisible();

            const lockedTitle = lastPost.container.locator('.mm-blocks-text-input').filter({hasText: /^Locked title/});
            await expect(lockedTitle.getByTestId('locked_titleinput')).toBeDisabled();

            const notifyBool = lastPost.container
                .locator('.mm-blocks-bool-input')
                .filter({hasText: 'Email notifications'});
            await expect(notifyBool).toBeVisible();
            await expect(notifyBool.getByText('Notify help')).toBeVisible();
            await expect(notifyBool.getByRole('checkbox', {name: 'Send me status updates by email'})).toBeChecked();

            const digestBool = lastPost.container.locator('.mm-blocks-bool-input').filter({hasText: 'Weekly digest'});
            await expect(digestBool.getByText('(optional)')).toBeVisible();
            await expect(
                digestBool.getByRole('checkbox', {name: 'Include this ticket in the weekly digest'}),
            ).not.toBeChecked();

            const lockedBool = lastPost.container.locator('.mm-blocks-bool-input').filter({hasText: 'Locked notify'});
            await expect(lockedBool.getByRole('checkbox', {name: 'Cannot change'})).toBeDisabled();

            const prioritySelect = lastPost.container.locator('.mm-blocks-select-input').filter({hasText: 'Priority'});
            await expect(prioritySelect).toBeVisible();
            await expect(prioritySelect.getByRole('combobox')).toHaveValue('Medium');

            const severitySelect = lastPost.container.locator('.mm-blocks-select-input').filter({hasText: 'Severity'});
            await expect(severitySelect.getByRole('radio', {name: 'SEV-1'})).toBeVisible();
            await expect(severitySelect.getByRole('radio', {name: 'SEV-2'})).toBeChecked();

            const dateInput = lastPost.container.locator('.mm-blocks-date-input').filter({hasText: 'Due date'});
            await expect(dateInput).toBeVisible();
            await expect(dateInput.locator('span.error-text')).toBeVisible();
            await expect(dateInput.getByText('Due date help')).toBeVisible();
            await expect(dateInput.getByRole('button', {name: /Jan 10, 2025/i})).toBeVisible();

            const optionalDate = lastPost.container.locator('.mm-blocks-date-input').filter({hasText: 'Optional due'});
            await expect(optionalDate.getByText('(optional)')).toBeVisible();
            await expect(optionalDate.locator('span.error-text')).toHaveCount(0);

            // Empty label: control still renders, without required/optional markers next to a label.
            const unlabeledDate = lastPost.container.locator('.mm-blocks-date-input').nth(2);
            await expect(unlabeledDate).toBeVisible();
            await expect(unlabeledDate.locator('label.control-label')).toHaveCount(0);

            const datetimeInput = lastPost.container.locator('.mm-blocks-datetime-input');
            await expect(datetimeInput).toBeVisible();
            await expect(datetimeInput.getByText('Meeting time')).toBeVisible();
            await expect(datetimeInput.getByText('Meeting help')).toBeVisible();
            await expect(datetimeInput.locator('.dateTime__date')).toBeVisible();
            await expect(datetimeInput.getByRole('button', {name: /Time|Select a time/i})).toBeVisible();

            const fileInput = lastPost.container.locator('.mm-blocks-file-input').filter({hasText: 'Attachments'});
            await expect(fileInput).toBeVisible();
            await expect(fileInput.getByText('File help')).toBeVisible();
            await expect(fileInput.getByText('Upload evidence')).toBeVisible();
            await expect(fileInput.getByRole('button', {name: 'Choose File'})).toBeEnabled();

            const lockedFile = lastPost.container.locator('.mm-blocks-file-input').filter({hasText: 'Locked files'});
            await expect(lockedFile.getByRole('button', {name: 'Choose File'})).toBeDisabled();
        },
    );

    test(
        'external mm_blocks date_input onChange sends form_values to integration',
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
                display_name: 'Playwright mm_blocks date_input onChange',
            });

            const integrationUrl = `${testConfig.webhookBaseUrl}/mm_blocks_integration_echo_form_values`;
            const marker = `E2E mm_blocks date_input onChange ${pw.random.id()}`;
            const expectedDue = isoDateForCalendarDay(20);

            await postIncomingWebhook(webhook.id, {
                text: marker,
                props: {
                    mm_blocks: [
                        {type: 'text', text: 'Pick a due date to verify onChange form_values.'},
                        {
                            type: 'date_input',
                            name: 'due',
                            label: 'Due date',
                            placeholder: 'Pick a due date',
                            onChange: 'pw_mm_blocks_date_onchange',
                        },
                    ],
                    mm_blocks_actions: {
                        pw_mm_blocks_date_onchange: {
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
            const anchorPost = lastPost.container;

            await anchorPost.hover();
            await expect(anchorPost.getByRole('button', {name: 'reply'})).toBeVisible();
            await anchorPost.getByRole('button', {name: 'reply'}).click();

            const threadPanel = channelsPage.page.getByRole('region', {name: /Thread/});
            await expect(threadPanel).toBeVisible();

            const rootInThread = threadPanel.getByTestId('rhsPostView').filter({hasText: marker}).last();
            await expect(rootInThread).toBeVisible();

            const dateField = rootInThread.locator('.mm-blocks-date-input');
            await dateField.getByRole('button', {name: /Pick a due date/i}).click();
            await expect(channelsPage.page.getByRole('grid')).toBeVisible();
            await channelsPage.page.getByRole('grid').getByText('20', {exact: true}).click();

            await expect(
                threadPanel.getByText(`Playwright mm_blocks form_values OK (due=${expectedDue})`),
            ).toBeVisible();
            await expect(threadPanel.getByText('(Only visible to you)', {exact: true})).toBeVisible();
        },
    );

    test(
        'external mm_blocks date and datetime form submit sends form_values to integration',
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
                display_name: 'Playwright mm_blocks date datetime submit',
            });

            const integrationUrl = `${testConfig.webhookBaseUrl}/mm_blocks_integration_echo_form_values`;
            const marker = `E2E mm_blocks date datetime submit ${pw.random.id()}`;
            const expectedDue = isoDateForCalendarDay(20);

            await postIncomingWebhook(webhook.id, {
                text: marker,
                props: {
                    mm_blocks: [
                        {
                            type: 'date_input',
                            name: 'due',
                            label: 'Due date',
                            placeholder: 'Pick a due date',
                        },
                        {
                            type: 'datetime_input',
                            name: 'meeting',
                            label: 'Meeting time',
                        },
                        {
                            type: 'button',
                            text: 'Submit dates',
                            style: 'primary',
                            subtype: 'submit',
                            action_id: 'pw_mm_blocks_date_submit',
                        },
                    ],
                    mm_blocks_actions: {
                        pw_mm_blocks_date_submit: {
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
            const anchorPost = lastPost.container;

            await anchorPost.hover();
            await expect(anchorPost.getByRole('button', {name: 'reply'})).toBeVisible();
            await anchorPost.getByRole('button', {name: 'reply'}).click();

            const threadPanel = channelsPage.page.getByRole('region', {name: /Thread/});
            await expect(threadPanel).toBeVisible();

            const rootInThread = threadPanel.getByTestId('rhsPostView').filter({hasText: marker}).last();
            await expect(rootInThread).toBeVisible();

            await rootInThread
                .locator('.mm-blocks-date-input')
                .getByRole('button', {name: /Pick a due date/i})
                .click();
            await expect(channelsPage.page.getByRole('grid')).toBeVisible();
            await channelsPage.page.getByRole('grid').getByText('20', {exact: true}).click();

            await rootInThread.locator('.mm-blocks-datetime-input .dateTime__date').getByRole('button').click();
            await expect(channelsPage.page.getByRole('grid')).toBeVisible();
            await channelsPage.page.getByRole('grid').getByText('22', {exact: true}).click();

            await rootInThread
                .locator('.mm-blocks-datetime-input')
                .getByRole('button', {name: /Time|Select a time/i})
                .first()
                .click();
            await channelsPage.page.getByRole('menuitem', {name: '3:00 PM'}).click();

            await rootInThread.getByRole('button', {name: 'Submit dates'}).click();

            const integrationEphemeral = threadPanel
                .getByTestId('rhsPostView')
                .filter({hasText: /Playwright mm_blocks form_values OK \(/});
            await expect(integrationEphemeral).toBeVisible();
            await expect(integrationEphemeral).toContainText(`due=${expectedDue}`);
            await expect(integrationEphemeral).toContainText(/meeting=\d{4}-\d{2}-\d{2}T/);
            await expect(integrationEphemeral.getByText('(Only visible to you)', {exact: true})).toBeVisible();
        },
    );

    test(
        'external mm_blocks file_input upload and submit sends file id form_values',
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
                display_name: 'Playwright mm_blocks file_input submit',
            });

            const integrationUrl = `${testConfig.webhookBaseUrl}/mm_blocks_integration_echo_form_values`;
            const marker = `E2E mm_blocks file_input submit ${pw.random.id()}`;
            const uploadName = `pw-mm-blocks-file-${pw.random.id()}.txt`;

            await postIncomingWebhook(webhook.id, {
                text: marker,
                props: {
                    mm_blocks: [
                        {
                            type: 'file_input',
                            name: 'attachments',
                            label: 'Attachments',
                            placeholder: 'Upload evidence',
                        },
                        {
                            type: 'button',
                            text: 'Submit files',
                            style: 'primary',
                            subtype: 'submit',
                            action_id: 'pw_mm_blocks_file_submit',
                        },
                    ],
                    mm_blocks_actions: {
                        pw_mm_blocks_file_submit: {
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
            const anchorPost = lastPost.container;

            await anchorPost.hover();
            await expect(anchorPost.getByRole('button', {name: 'reply'})).toBeVisible();
            await anchorPost.getByRole('button', {name: 'reply'}).click();

            const threadPanel = channelsPage.page.getByRole('region', {name: /Thread/});
            await expect(threadPanel).toBeVisible();

            const rootInThread = threadPanel.getByTestId('rhsPostView').filter({hasText: marker}).last();
            await expect(rootInThread).toBeVisible();

            const fileBlock = rootInThread.locator('.mm-blocks-file-input');
            await expect(fileBlock.getByRole('button', {name: 'Choose File'})).toBeVisible();
            await fileBlock.locator('input[type="file"]').setInputFiles({
                name: uploadName,
                mimeType: 'text/plain',
                buffer: Buffer.from(`playwright mm_blocks file_input ${pw.random.id()}\n`),
            });

            await expect(fileBlock.getByTestId('file-preview-item')).toBeVisible();
            await expect(fileBlock.getByLabel(new RegExp(`file thumbnail ${uploadName}`, 'i'))).toBeVisible();

            await rootInThread.getByRole('button', {name: 'Submit files'}).click();

            const integrationEphemeral = threadPanel
                .getByTestId('rhsPostView')
                .filter({hasText: /Playwright mm_blocks form_values OK \(attachments=/});
            await expect(integrationEphemeral).toBeVisible();
            await expect(integrationEphemeral).toContainText(/attachments=[a-z0-9]{26}/i);
            await expect(integrationEphemeral.getByText('(Only visible to you)', {exact: true})).toBeVisible();
        },
    );

    test(
        'external mm_blocks text_input, bool_input, and select form submit sends form_values',
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
                display_name: 'Playwright mm_blocks classic form submit',
            });

            const integrationUrl = `${testConfig.webhookBaseUrl}/mm_blocks_integration_echo_form_values`;
            const marker = `E2E mm_blocks classic form submit ${pw.random.id()}`;
            const titleValue = `PW title ${pw.random.id()}`;

            await postIncomingWebhook(webhook.id, {
                text: marker,
                props: {
                    mm_blocks: [
                        {
                            type: 'text_input',
                            name: 'title',
                            label: 'Title',
                            placeholder: 'Short summary',
                        },
                        {
                            type: 'bool_input',
                            name: 'notify_email',
                            label: 'Email notifications',
                            placeholder: 'Send me status updates by email',
                        },
                        {
                            type: 'select',
                            name: 'priority',
                            label: 'Priority',
                            placeholder: 'Choose priority',
                            style: 'compact',
                            options: [
                                {text: 'Low', value: 'low'},
                                {text: 'Medium', value: 'medium'},
                                {text: 'High', value: 'high'},
                            ],
                        },
                        {
                            type: 'select',
                            name: 'severity',
                            label: 'Severity',
                            style: 'expanded',
                            options: [
                                {text: 'SEV-1', value: 'sev1'},
                                {text: 'SEV-2', value: 'sev2'},
                            ],
                        },
                        {
                            type: 'button',
                            text: 'Submit form',
                            style: 'primary',
                            subtype: 'submit',
                            action_id: 'pw_mm_blocks_classic_form_submit',
                        },
                    ],
                    mm_blocks_actions: {
                        pw_mm_blocks_classic_form_submit: {
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
            const anchorPost = lastPost.container;

            await anchorPost.hover();
            await expect(anchorPost.getByRole('button', {name: 'reply'})).toBeVisible();
            await anchorPost.getByRole('button', {name: 'reply'}).click();

            const threadPanel = channelsPage.page.getByRole('region', {name: /Thread/});
            await expect(threadPanel).toBeVisible();

            const rootInThread = threadPanel.getByTestId('rhsPostView').filter({hasText: marker}).last();
            await expect(rootInThread).toBeVisible();

            await rootInThread.getByTestId('titleinput').fill(titleValue);
            await rootInThread.getByRole('checkbox', {name: 'Send me status updates by email'}).check();

            const prioritySelect = rootInThread.locator('.mm-blocks-select-input').filter({hasText: 'Priority'});
            await prioritySelect.getByRole('combobox').click();
            await channelsPage.page.getByRole('option', {name: 'High'}).click();

            await rootInThread.getByRole('radio', {name: 'SEV-1'}).click();
            await rootInThread.getByRole('button', {name: 'Submit form'}).click();

            const integrationEphemeral = threadPanel
                .getByTestId('rhsPostView')
                .filter({hasText: /Playwright mm_blocks form_values OK \(/});
            await expect(integrationEphemeral).toBeVisible();
            await expect(integrationEphemeral).toContainText(`title=${titleValue}`);
            await expect(integrationEphemeral).toContainText('notify_email=true');
            await expect(integrationEphemeral).toContainText('priority=high');
            await expect(integrationEphemeral).toContainText('severity=sev1');
            await expect(integrationEphemeral.getByText('(Only visible to you)', {exact: true})).toBeVisible();
        },
    );

    test(
        'external mm_blocks text_input onChange sends form_values to integration',
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
                display_name: 'Playwright mm_blocks text_input onChange',
            });

            const integrationUrl = `${testConfig.webhookBaseUrl}/mm_blocks_integration_echo_form_values`;
            const marker = `E2E mm_blocks text_input onChange ${pw.random.id()}`;
            const titleValue = `PW onChange ${pw.random.id()}`;

            await postIncomingWebhook(webhook.id, {
                text: marker,
                props: {
                    mm_blocks: [
                        {
                            type: 'text_input',
                            name: 'title',
                            label: 'Title',
                            placeholder: 'Short summary',
                            onChange: 'pw_mm_blocks_text_onchange',
                        },
                    ],
                    mm_blocks_actions: {
                        pw_mm_blocks_text_onchange: {
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
            const anchorPost = lastPost.container;

            await anchorPost.hover();
            await expect(anchorPost.getByRole('button', {name: 'reply'})).toBeVisible();
            await anchorPost.getByRole('button', {name: 'reply'}).click();

            const threadPanel = channelsPage.page.getByRole('region', {name: /Thread/});
            await expect(threadPanel).toBeVisible();

            const rootInThread = threadPanel.getByTestId('rhsPostView').filter({hasText: marker}).last();
            await expect(rootInThread).toBeVisible();

            // onChange fires per keystroke; fill once and assert the final value is echoed.
            await rootInThread.getByTestId('titleinput').fill(titleValue);

            await expect(
                threadPanel.getByText(`Playwright mm_blocks form_values OK (title=${titleValue})`),
            ).toBeVisible();
            await expect(threadPanel.getByText('(Only visible to you)', {exact: true})).toBeVisible();
        },
    );

    test(
        'external mm_blocks bool_input and select onChange send form_values to integration',
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
                display_name: 'Playwright mm_blocks bool select onChange',
            });

            const integrationUrl = `${testConfig.webhookBaseUrl}/mm_blocks_integration_echo_form_values`;
            const marker = `E2E mm_blocks bool select onChange ${pw.random.id()}`;

            await postIncomingWebhook(webhook.id, {
                text: marker,
                props: {
                    mm_blocks: [
                        {
                            type: 'bool_input',
                            name: 'notify_email',
                            label: 'Email notifications',
                            placeholder: 'Send me status updates by email',
                            onChange: 'pw_mm_blocks_bool_onchange',
                        },
                        {
                            type: 'select',
                            name: 'priority',
                            label: 'Priority',
                            placeholder: 'Choose priority',
                            style: 'compact',
                            onChange: 'pw_mm_blocks_select_onchange',
                            options: [
                                {text: 'Low', value: 'low'},
                                {text: 'Medium', value: 'medium'},
                                {text: 'High', value: 'high'},
                            ],
                        },
                    ],
                    mm_blocks_actions: {
                        pw_mm_blocks_bool_onchange: {
                            type: 'external',
                            url: integrationUrl,
                            context: {},
                        },
                        pw_mm_blocks_select_onchange: {
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
            const anchorPost = lastPost.container;

            await anchorPost.hover();
            await expect(anchorPost.getByRole('button', {name: 'reply'})).toBeVisible();
            await anchorPost.getByRole('button', {name: 'reply'}).click();

            const threadPanel = channelsPage.page.getByRole('region', {name: /Thread/});
            await expect(threadPanel).toBeVisible();

            const rootInThread = threadPanel.getByTestId('rhsPostView').filter({hasText: marker}).last();
            await expect(rootInThread).toBeVisible();

            await rootInThread.getByRole('checkbox', {name: 'Send me status updates by email'}).check();
            await expect(
                threadPanel.getByText(/Playwright mm_blocks form_values OK \(.*notify_email=true/),
            ).toBeVisible();

            const prioritySelect = rootInThread.locator('.mm-blocks-select-input').filter({hasText: 'Priority'});
            await prioritySelect.getByRole('combobox').click();
            await channelsPage.page.getByRole('option', {name: 'High'}).click();

            await expect(threadPanel.getByText(/Playwright mm_blocks form_values OK \(.*priority=high/)).toBeVisible();
            await expect(threadPanel.getByText('(Only visible to you)', {exact: true}).first()).toBeVisible();
        },
    );

    test(
        'external mm_blocks dynamic select loads options from lookup and submits selected value',
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
                display_name: 'Playwright mm_blocks dynamic select',
            });

            const lookupUrl = `${testConfig.webhookBaseUrl}/mm_blocks_integration_lookup`;
            const submitUrl = `${testConfig.webhookBaseUrl}/mm_blocks_integration_echo_form_values`;
            const marker = `E2E mm_blocks dynamic select ${pw.random.id()}`;

            await postIncomingWebhook(webhook.id, {
                text: marker,
                props: {
                    mm_blocks: [
                        {
                            type: 'select',
                            name: 'pick',
                            label: 'Dynamic option',
                            placeholder: 'Type to search…',
                            data_source: 'dynamic',
                            data_source_action: 'pw_mm_blocks_lookup',
                        },
                        {
                            type: 'button',
                            text: 'Submit pick',
                            style: 'primary',
                            subtype: 'submit',
                            action_id: 'pw_mm_blocks_dynamic_submit',
                        },
                    ],
                    mm_blocks_actions: {
                        pw_mm_blocks_lookup: {
                            type: 'external',
                            url: lookupUrl,
                            context: {},
                        },
                        pw_mm_blocks_dynamic_submit: {
                            type: 'external',
                            url: submitUrl,
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

            await anchorPost.hover();
            await expect(anchorPost.getByRole('button', {name: 'reply'})).toBeVisible();
            await anchorPost.getByRole('button', {name: 'reply'}).click();

            const threadPanel = channelsPage.page.getByRole('region', {name: /Thread/});
            await expect(threadPanel).toBeVisible();

            const rootInThread = threadPanel.getByTestId('rhsPostView').filter({hasText: marker}).last();
            await expect(rootInThread).toBeVisible();

            const dynamicSelect = rootInThread.locator('.mm-blocks-select-input').filter({hasText: 'Dynamic option'});
            const combobox = dynamicSelect.getByRole('combobox');
            await expect(combobox).toBeVisible();
            await combobox.click();
            await combobox.fill('Alp');

            await expect(channelsPage.page.getByRole('option', {name: 'Alpha'})).toBeVisible();
            await channelsPage.page.getByRole('option', {name: 'Alpha'}).click();

            await rootInThread.getByRole('button', {name: 'Submit pick'}).click();

            const integrationEphemeral = threadPanel
                .getByTestId('rhsPostView')
                .filter({hasText: /Playwright mm_blocks form_values OK \(pick=opt_alpha\)/});
            await expect(integrationEphemeral).toBeVisible();
            await expect(integrationEphemeral.getByText('(Only visible to you)', {exact: true})).toBeVisible();
        },
    );
});

/** YYYY-MM-DD for `day` in the calendar's current month (local browser timezone). */
function isoDateForCalendarDay(day: number): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-${String(day).padStart(2, '0')}`;
}
