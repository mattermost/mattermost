// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';

import {expect, test} from '@mattermost/playwright-lib';

import {postToWebhook} from '../webhook_helpers';

/** Legacy attachments are translated to mm_blocks; author/title live in markdown text blocks. */
function mmBlocks(lastPost: {mmBlocks: Locator}) {
    return lastPost.mmBlocks;
}

async function expectMmBlocksAuthorName(lastPost: {mmBlocks: Locator}, name: string) {
    const blocks = mmBlocks(lastPost);
    // Attachment translation renders author before title; title <p> also contains the link text via hasText.
    await expect(blocks.locator('p').first()).toHaveText(name);
}

async function expectMmBlocksTitleLink(lastPost: {mmBlocks: Locator}, title: string) {
    await expect(mmBlocks(lastPost).getByRole('link', {name: title})).toBeVisible();
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

            await expect(mmBlocks(lastPost)).toBeVisible();

            // * Verify the author name has decoded entities: &#40; → (, &#41; → ), &amp; → &
            await expectMmBlocksAuthorName(lastPost, 'Bot (v2.1) & Integrations');

            // * Verify the title has decoded entities
            await expectMmBlocksTitleLink(lastPost, 'Future Plan for Plugins (3rd party & core)');
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

            await expect(mmBlocks(lastPost)).toBeVisible();

            // * Verify the numeric entities are decoded in the title link
            await expectMmBlocksTitleLink(lastPost, '"All Hands" Meeting [Q1] - 9:00');
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

            await expect(mmBlocks(lastPost)).toBeVisible();

            // * Verify named entities are decoded in the author name
            await expectMmBlocksAuthorName(lastPost, 'CI <Build> "System" \'Owner\'');
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

            await expect(mmBlocks(lastPost)).toBeVisible();

            // * Should show &lt;safe&gt; literally, not <safe>
            await expectMmBlocksAuthorName(lastPost, '&lt;safe&gt;');
            await expectMmBlocksTitleLink(lastPost, '&lt;safe&gt;');
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

            await expect(mmBlocks(lastPost)).toBeVisible();

            // * Verify text passes through unchanged
            await expectMmBlocksAuthorName(lastPost, 'Simple Bot Name');
            await expectMmBlocksTitleLink(lastPost, 'A normal title with no special chars');
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

            await expect(mmBlocks(lastPost)).toBeVisible();

            // * Verify realistic plugin content is properly decoded
            await expectMmBlocksAuthorName(lastPost, 'Google Calendar | via Plugin (v1.0)');
            await expectMmBlocksTitleLink(lastPost, 'Team Standup (Daily) - 9:00 AM');
        },
    );
});
