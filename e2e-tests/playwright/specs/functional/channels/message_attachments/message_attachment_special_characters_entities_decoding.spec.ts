// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {createTownSquareWebhook, postToWebhook} from './support';

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

            // # Create an incoming webhook for the channel
            const {webhookId} = await createTownSquareWebhook(adminClient, team.id, 'E2E Attachment Test Hook');

            // # Post a webhook payload with HTML-encoded entities in title and author_name
            await postToWebhook(webhookId, {
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

            const {webhookId} = await createTownSquareWebhook(adminClient, team.id, 'E2E Numeric Entities Hook');

            // # Post with numeric entities: &#34; ("), &#39; ('), &#58; (:), &#91; ([), &#93; (])
            await postToWebhook(webhookId, {
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

            const {webhookId} = await createTownSquareWebhook(adminClient, team.id, 'E2E Named Entities Hook');

            await postToWebhook(webhookId, {
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
});
