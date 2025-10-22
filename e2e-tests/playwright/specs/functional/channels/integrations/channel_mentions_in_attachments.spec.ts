// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, testConfig} from '@mattermost/playwright-lib';

test.describe('incoming webhook channel mentions in attachments', () => {
    /**
     * @objective Verify that channel mentions in attachment pretext render as clickable links for public channels that the user is not a member of
     */
    test(
        'renders channel mention in attachment pretext as link for public channel non-member',
        {tag: '@integrations'},
        async ({pw, request}) => {
            // # Initialize test setup with a user and channel
            const {team, user, userClient} = await pw.initSetup();

            // # Create a channel for the webhook
            const testChannel = await userClient.createChannel({
                team_id: team.id,
                name: 'test-webhook-channel',
                display_name: 'Test Webhook Channel',
                type: 'O',
            });

            // # Get admin client for creating webhook and test channels
            const {adminClient} = await pw.getAdminClient();

            // # Create incoming webhook (requires admin permissions)
            const webhook = await adminClient.createIncomingWebhook({
                channel_id: testChannel.id,
                display_name: 'Test Webhook',
                description: 'Test webhook for channel mentions',
            });
            const publicChannel = await adminClient.createChannel({
                team_id: team.id,
                name: 'public-channel',
                display_name: 'Public Channel',
                type: 'O',
            });

            // # Post webhook with channel mention in pretext
            const webhookPayload = {
                channel: testChannel.name,
                attachments: [
                    {
                        pretext: `Check out ~${publicChannel.name} for more info`,
                        text: 'This is the attachment text.',
                    },
                ],
            };

            const webhookUrl = `${testConfig.baseURL}/hooks/${webhook.id}`;
            await request.post(webhookUrl, {
                data: webhookPayload,
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            // # Login and navigate to the test channel
            const {page, channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, testChannel.name);
            await channelsPage.toBeVisible();

            // # Get the last post
            const lastPost = await channelsPage.getLastPost();

            // * Verify channel mention in pretext renders as clickable link
            const pretextLink = lastPost.container.locator('.attachment__thumb-pretext a.mention-link');
            await expect(pretextLink).toBeVisible();
            await expect(pretextLink).toHaveAttribute('data-channel-mention', publicChannel.name);
            await expect(pretextLink).toContainText(`~${publicChannel.display_name}`);

            // * Verify clicking the link navigates to the channel
            await pretextLink.click();
            await page.waitForURL(`**/${team.name}/channels/${publicChannel.name}`);
        },
    );

    /**
     * @objective Verify that channel mentions in attachment text render as clickable links for public channels that the user is not a member of
     */
    test(
        'renders channel mention in attachment text as link for public channel non-member',
        {tag: '@integrations'},
        async ({pw, request}) => {
            // # Initialize test setup
            const {team, user, userClient} = await pw.initSetup();

            // # Create a channel for the webhook
            const testChannel = await userClient.createChannel({
                team_id: team.id,
                name: 'test-webhook-text-channel',
                display_name: 'Test Webhook Text Channel',
                type: 'O',
            });

            // # Get admin client for creating webhook and test channels
            const {adminClient} = await pw.getAdminClient();

            // # Create incoming webhook (requires admin permissions)
            const webhook = await adminClient.createIncomingWebhook({
                channel_id: testChannel.id,
                display_name: 'Test Webhook',
                description: 'Test webhook for channel mentions',
            });
            const publicChannel = await adminClient.createChannel({
                team_id: team.id,
                name: 'public-text-channel',
                display_name: 'Public Text Channel',
                type: 'O',
            });

            // # Post webhook with channel mention in text
            const webhookPayload = {
                channel: testChannel.name,
                attachments: [
                    {
                        pretext: 'Attachment with channel mention',
                        text: `Please post updates in ~${publicChannel.name} going forward.`,
                    },
                ],
            };

            const webhookUrl = `${testConfig.baseURL}/hooks/${webhook.id}`;
            await request.post(webhookUrl, {
                data: webhookPayload,
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            // # Login and navigate to the test channel
            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, testChannel.name);
            await channelsPage.toBeVisible();

            // # Get the last post
            const lastPost = await channelsPage.getLastPost();

            // * Verify channel mention in text renders as clickable link
            const textLink = lastPost.container.locator(
                '.attachment__body .post-message__text-container a.mention-link',
            );
            await expect(textLink).toBeVisible();
            await expect(textLink).toHaveAttribute('data-channel-mention', publicChannel.name);
            await expect(textLink).toContainText(`~${publicChannel.display_name}`);
        },
    );

    /**
     * @objective Verify that channel mentions in attachment field values render as clickable links for public channels that the user is not a member of
     */
    test(
        'renders channel mention in field value as link for public channel non-member',
        {tag: '@integrations'},
        async ({pw, request}) => {
            // # Initialize test setup
            const {team, user, userClient} = await pw.initSetup();

            // # Create a channel for the webhook
            const testChannel = await userClient.createChannel({
                team_id: team.id,
                name: 'test-webhook-field-channel',
                display_name: 'Test Webhook Field Channel',
                type: 'O',
            });

            // # Get admin client for creating webhook and test channels
            const {adminClient} = await pw.getAdminClient();

            // # Create incoming webhook (requires admin permissions)
            const webhook = await adminClient.createIncomingWebhook({
                channel_id: testChannel.id,
                display_name: 'Test Webhook',
                description: 'Test webhook for channel mentions',
            });
            const publicChannel = await adminClient.createChannel({
                team_id: team.id,
                name: 'public-field-channel',
                display_name: 'Public Field Channel',
                type: 'O',
            });

            // # Post webhook with channel mention in field value
            const webhookPayload = {
                channel: testChannel.name,
                attachments: [
                    {
                        pretext: 'Deployment notification',
                        text: 'Deployment completed successfully',
                        fields: [
                            {
                                title: 'Environment',
                                value: 'Production',
                                short: true,
                            },
                            {
                                title: 'Notified Channels',
                                value: `~${publicChannel.name}`,
                                short: true,
                            },
                        ],
                    },
                ],
            };

            const webhookUrl = `${testConfig.baseURL}/hooks/${webhook.id}`;
            await request.post(webhookUrl, {
                data: webhookPayload,
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            // # Login and navigate to the test channel
            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, testChannel.name);
            await channelsPage.toBeVisible();

            // # Get the last post
            const lastPost = await channelsPage.getLastPost();

            // * Verify channel mention in field value renders as clickable link
            const fieldLink = lastPost.container.locator('.attachment-field a.mention-link');
            await expect(fieldLink).toBeVisible();
            await expect(fieldLink).toHaveAttribute('data-channel-mention', publicChannel.name);
            await expect(fieldLink).toContainText(`~${publicChannel.display_name}`);
        },
    );

    /**
     * @objective Verify that channel mentions in field titles do NOT render as clickable links (titles are labels, not content)
     */
    test('does not render channel mention in field title as link', {tag: '@integrations'}, async ({pw, request}) => {
        // # Initialize test setup
        const {team, user, userClient} = await pw.initSetup();

        // # Create a channel for the webhook
        const testChannel = await userClient.createChannel({
            team_id: team.id,
            name: 'test-webhook-title-channel',
            display_name: 'Test Webhook Title Channel',
            type: 'O',
        });

        // # Get admin client for creating webhook and test channels
        const {adminClient} = await pw.getAdminClient();

        // # Create incoming webhook (requires admin permissions)
        const webhook = await adminClient.createIncomingWebhook({
            channel_id: testChannel.id,
            display_name: 'Test Webhook',
            description: 'Test webhook for channel mentions',
        });
        const fieldTitleChannel = await adminClient.createChannel({
            team_id: team.id,
            name: 'field-title-channel',
            display_name: 'Field Title Channel',
            type: 'O',
        });

        // # Post webhook with channel mention in field title
        const webhookPayload = {
            channel: testChannel.name,
            attachments: [
                {
                    pretext: 'Field title test',
                    text: 'Testing that channel mentions in titles remain as plain text',
                    fields: [
                        {
                            title: `Status for ~${fieldTitleChannel.name}`,
                            value: 'All systems operational',
                            short: false,
                        },
                    ],
                },
            ],
        };

        const webhookUrl = `${testConfig.baseURL}/hooks/${webhook.id}`;
        await request.post(webhookUrl, {
            data: webhookPayload,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // # Login and navigate to the test channel
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, testChannel.name);
        await channelsPage.toBeVisible();

        // # Get the last post
        const lastPost = await channelsPage.getLastPost();

        // * Verify field title contains text but no mention link
        const fieldCaption = lastPost.container.locator('.attachment-field__caption');
        await expect(fieldCaption).toContainText('Status for');

        // * Verify no mention-link exists in the field title
        const titleLink = fieldCaption.locator('a.mention-link');
        await expect(titleLink).not.toBeVisible();
    });

    /**
     * @objective Verify that multiple channel mentions in the same attachment all render as clickable links
     */
    test(
        'renders multiple channel mentions in same attachment as links',
        {tag: '@integrations'},
        async ({pw, request}) => {
            // # Initialize test setup
            const {team, user, userClient} = await pw.initSetup();

            // # Create a channel for the webhook
            const testChannel = await userClient.createChannel({
                team_id: team.id,
                name: 'test-webhook-multiple-channel',
                display_name: 'Test Webhook Multiple Channel',
                type: 'O',
            });

            // # Get admin client for creating webhook and test channels
            const {adminClient} = await pw.getAdminClient();

            // # Create incoming webhook (requires admin permissions)
            const webhook = await adminClient.createIncomingWebhook({
                channel_id: testChannel.id,
                display_name: 'Test Webhook',
                description: 'Test webhook for channel mentions',
            });
            const publicChannel1 = await adminClient.createChannel({
                team_id: team.id,
                name: 'public-multiple-1',
                display_name: 'Public Multiple 1',
                type: 'O',
            });

            const publicChannel2 = await adminClient.createChannel({
                team_id: team.id,
                name: 'public-multiple-2',
                display_name: 'Public Multiple 2',
                type: 'O',
            });

            // # Post webhook with multiple channel mentions
            const webhookPayload = {
                channel: testChannel.name,
                attachments: [
                    {
                        pretext: `Multiple channels: ~${publicChannel1.name} and ~${publicChannel2.name}`,
                        text: `Also check ~${publicChannel1.name} and ~${publicChannel2.name}`,
                        fields: [
                            {
                                title: 'Affected Channels',
                                value: `~${publicChannel1.name}, ~${publicChannel2.name}`,
                                short: false,
                            },
                        ],
                    },
                ],
            };

            const webhookUrl = `${testConfig.baseURL}/hooks/${webhook.id}`;
            await request.post(webhookUrl, {
                data: webhookPayload,
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            // # Login and navigate to the test channel
            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, testChannel.name);
            await channelsPage.toBeVisible();

            // # Get the last post
            const lastPost = await channelsPage.getLastPost();

            // * Verify all channel mentions render as links (6 total: 2 in pretext, 2 in text, 2 in field)
            const allLinks = lastPost.container.locator('a.mention-link');
            await expect(allLinks).toHaveCount(6);

            // * Verify pretext has both links
            const pretextLinks = lastPost.container.locator('.attachment__thumb-pretext a.mention-link');
            await expect(pretextLinks).toHaveCount(2);

            // * Verify text has both links
            const textLinks = lastPost.container.locator(
                '.attachment__body .post-message__text-container a.mention-link',
            );
            await expect(textLinks).toHaveCount(2);

            // * Verify field has both links
            const fieldLinks = lastPost.container.locator('.attachment-field a.mention-link');
            await expect(fieldLinks).toHaveCount(2);
        },
    );

    /**
     * @objective Verify that private channel mentions render as plain text for non-members (no clickable links)
     */
    test(
        'does not render private channel mention as link for non-member',
        {tag: '@integrations'},
        async ({pw, request}) => {
            // # Initialize test setup
            const {team, user, userClient} = await pw.initSetup();

            // # Create a channel for the webhook
            const testChannel = await userClient.createChannel({
                team_id: team.id,
                name: 'test-webhook-private-channel',
                display_name: 'Test Webhook Private Channel',
                type: 'O',
            });

            // # Get admin client for creating webhook and test channels
            const {adminClient} = await pw.getAdminClient();

            // # Create incoming webhook (requires admin permissions)
            const webhook = await adminClient.createIncomingWebhook({
                channel_id: testChannel.id,
                display_name: 'Test Webhook',
                description: 'Test webhook for channel mentions',
            });
            const privateChannel = await adminClient.createChannel({
                team_id: team.id,
                name: 'private-channel',
                display_name: 'Private Channel',
                type: 'P',
            });

            // # Post webhook with private channel mention
            const webhookPayload = {
                channel: testChannel.name,
                attachments: [
                    {
                        pretext: 'Private channel test',
                        text: `This references ~${privateChannel.name} which is private`,
                    },
                ],
            };

            const webhookUrl = `${testConfig.baseURL}/hooks/${webhook.id}`;
            await request.post(webhookUrl, {
                data: webhookPayload,
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            // # Login and navigate to the test channel
            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, testChannel.name);
            await channelsPage.toBeVisible();

            // # Get the last post
            const lastPost = await channelsPage.getLastPost();

            // * Verify private channel mention appears as text
            await expect(lastPost.container).toContainText(`~${privateChannel.name}`);

            // * Verify no mention-link exists for the private channel
            const privateLink = lastPost.container.locator(
                `.attachment__body a.mention-link[data-channel-mention="${privateChannel.name}"]`,
            );
            await expect(privateLink).not.toBeVisible();
        },
    );

    /**
     * @objective Verify that channel mentions work consistently in both main message and attachments
     */
    test(
        'renders channel mentions consistently in main message and attachment',
        {tag: '@integrations'},
        async ({pw, request}) => {

            // # Initialize test setup
            const {team, user, userClient} = await pw.initSetup();

            // # Create a channel for the webhook
            const testChannel = await userClient.createChannel({
                team_id: team.id,
                name: 'test-webhook-consistency-channel',
                display_name: 'Test Webhook Consistency Channel',
                type: 'O',
            });

            // # Get admin client for creating webhook and test channels
            const {adminClient} = await pw.getAdminClient();

            // # Create incoming webhook (requires admin permissions)
            const webhook = await adminClient.createIncomingWebhook({
                channel_id: testChannel.id,
                display_name: 'Test Webhook',
                description: 'Test webhook for channel mentions',
            });
            const publicChannel = await adminClient.createChannel({
                team_id: team.id,
                name: 'consistency-channel',
                display_name: 'Consistency Channel',
                type: 'O',
            });

            // # Post webhook with channel mention in both main message and attachment
            const webhookPayload = {
                channel: testChannel.name,
                text: `Main message mentions ~${publicChannel.name}`,
                attachments: [
                    {
                        text: `Attachment also mentions ~${publicChannel.name}`,
                    },
                ],
            };

            const webhookUrl = `${testConfig.baseURL}/hooks/${webhook.id}`;
            await request.post(webhookUrl, {
                data: webhookPayload,
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            // # Login and navigate to the test channel
            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, testChannel.name);
            await channelsPage.toBeVisible();

            // # Get the last post
            const lastPost = await channelsPage.getLastPost();

            // * Verify channel mention in main message renders as link
            const mainMessageLink = lastPost.container.locator('.post-message__text a.mention-link');
            await expect(mainMessageLink).toBeVisible();
            await expect(mainMessageLink).toHaveAttribute('data-channel-mention', publicChannel.name);

            // * Verify channel mention in attachment also renders as link
            const attachmentLink = lastPost.container.locator('.attachment__body a.mention-link');
            await expect(attachmentLink).toBeVisible();
            await expect(attachmentLink).toHaveAttribute('data-channel-mention', publicChannel.name);
        },
    );

    /**
     * @objective Verify that channel mentions in attachment titles do NOT render as clickable links (titles are labels, not content)
     */
    test(
        'does not render channel mention in attachment title as link',
        {tag: '@integrations'},
        async ({pw, request}) => {
            // # Initialize test setup
            const {team, user, userClient} = await pw.initSetup();

            // # Create a channel for the webhook
            const testChannel = await userClient.createChannel({
                team_id: team.id,
                name: 'test-webhook-attachment-title-channel',
                display_name: 'Test Webhook Attachment Title Channel',
                type: 'O',
            });

            // # Get admin client for creating webhook and test channels
            const {adminClient} = await pw.getAdminClient();

            // # Create incoming webhook (requires admin permissions)
            const webhook = await adminClient.createIncomingWebhook({
                channel_id: testChannel.id,
                display_name: 'Test Webhook',
                description: 'Test webhook for channel mentions',
            });
            const attachmentTitleChannel = await adminClient.createChannel({
                team_id: team.id,
                name: 'attachment-title-channel',
                display_name: 'Attachment Title Channel',
                type: 'O',
            });

            // # Post webhook with channel mention in attachment title
            const webhookPayload = {
                channel: testChannel.name,
                attachments: [
                    {
                        title: `Status for ~${attachmentTitleChannel.name}`,
                        text: 'The channel mention in the title above should be plain text',
                    },
                ],
            };

            const webhookUrl = `${testConfig.baseURL}/hooks/${webhook.id}`;
            await request.post(webhookUrl, {
                data: webhookPayload,
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            // # Login and navigate to the test channel
            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, testChannel.name);
            await channelsPage.toBeVisible();

            // # Get the last post
            const lastPost = await channelsPage.getLastPost();

            // * Verify attachment title contains text but no mention link
            const attachmentTitle = lastPost.container.locator('.attachment__title');
            await expect(attachmentTitle).toContainText('Status for');

            // * Verify no mention-link exists in the attachment title
            const titleLink = attachmentTitle.locator('a.mention-link');
            await expect(titleLink).not.toBeVisible();
        },
    );
});
