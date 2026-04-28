// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, testConfig} from '@mattermost/playwright-lib';

/**
 * Posts a JSON payload to an incoming webhook URL.
 */
async function postToWebhook(webhookId: string, payload: Record<string, unknown>) {
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

test.describe('Message attachment special character decoding', () => {
    /**
     * @objective Verify that HTML entities in message attachment author_name and title
     * fields are decoded to their readable characters when rendered in the UI.
     * This ensures parity with the server-side Go html.UnescapeString behavior.
     */
    test(
        'decodes HTML entities in attachment title and author_name from an incoming webhook',
        {tag: ['@smoke', '@message_attachments']},
        async ({pw}) => {
            const {team, user, adminClient} = await pw.initSetup();

            const channels = await adminClient.getMyChannels(team.id);
            const townSquare = channels.find((ch) => ch.name === 'town-square');
            if (!townSquare) {
                throw new Error('Town Square channel not found');
            }

            // # Create an incoming webhook for the channel
            const webhook = await adminClient.createIncomingWebhook({
                channel_id: townSquare.id,
                display_name: 'E2E Attachment Test Hook',
            });

            // # Post a webhook payload with HTML-encoded entities in title and author_name
            await postToWebhook(webhook.id, {
                attachments: [
                    {
                        author_name: 'Bot &#40;v2.1&#41; &amp; Integrations',
                        title: 'Future Plan for Plugins &#40;3rd party &amp; core&#41;',
                        title_link: 'https://example.com',
                        text: 'Attachment body text',
                    },
                ],
            });

            // # Log in and navigate to the channel
            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            // # Get the last post which should contain the webhook attachment
            const lastPost = await channelsPage.getLastPost();
            await lastPost.toBeVisible();

            // * Verify the author name has decoded entities: &#40; → (, &#41; → ), &amp; → &
            const authorName = lastPost.container.locator('.attachment__author-name');
            await expect(authorName).toHaveText('Bot (v2.1) & Integrations');

            // * Verify the title has decoded entities
            const titleLink = lastPost.container.locator('.attachment__title-link');
            await expect(titleLink).toHaveText('Future Plan for Plugins (3rd party & core)');
        },
    );

    test(
        'decodes numeric HTML entities in attachment title with a title_link',
        {tag: ['@message_attachments']},
        async ({pw}) => {
            const {team, user, adminClient} = await pw.initSetup();

            const channels = await adminClient.getMyChannels(team.id);
            const townSquare = channels.find((ch) => ch.name === 'town-square');
            if (!townSquare) {
                throw new Error('Town Square channel not found');
            }

            const webhook = await adminClient.createIncomingWebhook({
                channel_id: townSquare.id,
                display_name: 'E2E Numeric Entities Hook',
            });

            // # Post with numeric entities: &#34; ("), &#39; ('), &#58; (:), &#91; ([), &#93; (])
            await postToWebhook(webhook.id, {
                attachments: [
                    {
                        title: '&#34;All Hands&#34; Meeting &#91;Q1&#93; &#45; 9&#58;00',
                        title_link: 'https://example.com',
                        text: 'Some body text',
                    },
                ],
            });

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const lastPost = await channelsPage.getLastPost();
            await lastPost.toBeVisible();

            // * Verify the numeric entities are decoded in the title link
            const titleLink = lastPost.container.locator('.attachment__title-link');
            await expect(titleLink).toHaveText('"All Hands" Meeting [Q1] - 9:00');
        },
    );

    test(
        'decodes named HTML entities (&lt; &gt; &quot; &apos;) in author_name',
        {tag: ['@message_attachments']},
        async ({pw}) => {
            const {team, user, adminClient} = await pw.initSetup();

            const channels = await adminClient.getMyChannels(team.id);
            const townSquare = channels.find((ch) => ch.name === 'town-square');
            if (!townSquare) {
                throw new Error('Town Square channel not found');
            }

            const webhook = await adminClient.createIncomingWebhook({
                channel_id: townSquare.id,
                display_name: 'E2E Named Entities Hook',
            });

            await postToWebhook(webhook.id, {
                attachments: [
                    {
                        author_name: 'CI &lt;Build&gt; &quot;System&quot; &apos;Owner&apos;',
                        text: 'Build results',
                    },
                ],
            });

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const lastPost = await channelsPage.getLastPost();
            await lastPost.toBeVisible();

            // * Verify named entities are decoded in the author name
            const authorName = lastPost.container.locator('.attachment__author-name');
            await expect(authorName).toHaveText('CI <Build> "System" \'Owner\'');
        },
    );

    test(
        'does not double-decode already-encoded entities in attachment fields',
        {tag: ['@message_attachments']},
        async ({pw}) => {
            const {team, user, adminClient} = await pw.initSetup();

            const channels = await adminClient.getMyChannels(team.id);
            const townSquare = channels.find((ch) => ch.name === 'town-square');
            if (!townSquare) {
                throw new Error('Town Square channel not found');
            }

            const webhook = await adminClient.createIncomingWebhook({
                channel_id: townSquare.id,
                display_name: 'E2E Double Encode Hook',
            });

            // &amp;lt; should decode only one level: &amp; → &, leaving &lt; as literal text
            await postToWebhook(webhook.id, {
                attachments: [
                    {
                        author_name: '&amp;lt;safe&amp;gt;',
                        title: '&amp;lt;safe&amp;gt;',
                        title_link: 'https://example.com',
                        text: 'Testing double-encoding safety',
                    },
                ],
            });

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const lastPost = await channelsPage.getLastPost();
            await lastPost.toBeVisible();

            // * Should show &lt;safe&gt; literally, not <safe>
            const authorName = lastPost.container.locator('.attachment__author-name');
            await expect(authorName).toHaveText('&lt;safe&gt;');

            const titleLink = lastPost.container.locator('.attachment__title-link');
            await expect(titleLink).toHaveText('&lt;safe&gt;');
        },
    );

    test(
        'renders plain text without entities unchanged in attachment title and author_name',
        {tag: ['@message_attachments']},
        async ({pw}) => {
            const {team, user, adminClient} = await pw.initSetup();

            const channels = await adminClient.getMyChannels(team.id);
            const townSquare = channels.find((ch) => ch.name === 'town-square');
            if (!townSquare) {
                throw new Error('Town Square channel not found');
            }

            const webhook = await adminClient.createIncomingWebhook({
                channel_id: townSquare.id,
                display_name: 'E2E Plain Text Hook',
            });

            await postToWebhook(webhook.id, {
                attachments: [
                    {
                        author_name: 'Simple Bot Name',
                        title: 'A normal title with no special chars',
                        title_link: 'https://example.com',
                        text: 'Regular body',
                    },
                ],
            });

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const lastPost = await channelsPage.getLastPost();
            await lastPost.toBeVisible();

            // * Verify text passes through unchanged
            const authorName = lastPost.container.locator('.attachment__author-name');
            await expect(authorName).toHaveText('Simple Bot Name');

            const titleLink = lastPost.container.locator('.attachment__title-link');
            await expect(titleLink).toHaveText('A normal title with no special chars');
        },
    );

    test(
        'decodes realistic calendar plugin payload with parentheses and ampersands',
        {tag: ['@message_attachments']},
        async ({pw}) => {
            const {team, user, adminClient} = await pw.initSetup();

            const channels = await adminClient.getMyChannels(team.id);
            const townSquare = channels.find((ch) => ch.name === 'town-square');
            if (!townSquare) {
                throw new Error('Town Square channel not found');
            }

            const webhook = await adminClient.createIncomingWebhook({
                channel_id: townSquare.id,
                display_name: 'E2E Calendar Hook',
            });

            // Realistic payload from a Google Calendar-like plugin
            await postToWebhook(webhook.id, {
                attachments: [
                    {
                        author_name: 'Google Calendar &#124; via Plugin &#40;v1.0&#41;',
                        title: 'Team Standup &#40;Daily&#41; &#45; 9&#58;00 AM',
                        title_link: 'https://calendar.example.com/event/123',
                        text: 'You have an upcoming event',
                    },
                ],
            });

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            const lastPost = await channelsPage.getLastPost();
            await lastPost.toBeVisible();

            // * Verify realistic plugin content is properly decoded
            const authorName = lastPost.container.locator('.attachment__author-name');
            await expect(authorName).toHaveText('Google Calendar | via Plugin (v1.0)');

            const titleLink = lastPost.container.locator('.attachment__title-link');
            await expect(titleLink).toHaveText('Team Standup (Daily) - 9:00 AM');
        },
    );
});
