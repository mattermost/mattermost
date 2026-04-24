// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {createTownSquareWebhook, postToWebhook} from './support';

test.describe('Message attachment special character decoding', () => {
    test(
        'does not double-decode already-encoded entities in attachment fields',
        {tag: ['@message_attachments']},
        async ({pw}) => {
            const {team, user, adminClient} = await pw.initSetup();

            const {webhookId} = await createTownSquareWebhook(adminClient, team.id, 'E2E Double Encode Hook');

            // &amp;lt; should decode only one level: &amp; → &, leaving &lt; as literal text
            await postToWebhook(webhookId, {
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

            const {webhookId} = await createTownSquareWebhook(adminClient, team.id, 'E2E Plain Text Hook');

            await postToWebhook(webhookId, {
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

            const {webhookId} = await createTownSquareWebhook(adminClient, team.id, 'E2E Calendar Hook');

            // Realistic payload from a Google Calendar-like plugin
            await postToWebhook(webhookId, {
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
