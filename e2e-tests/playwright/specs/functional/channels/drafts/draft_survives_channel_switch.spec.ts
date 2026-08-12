// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';
import type {PostList} from '@mattermost/types/posts';

/**
 * Guards the draft persist path around the composer change that refuses to
 * adopt another channel's draft as local state. Persistence to the store is
 * unchanged; these tests pin that the previous channel's draft still saves,
 * restores, and is not stolen by the destination composer.
 */
test.describe('draft survives channel switch', () => {
    test(
        'typed draft stays on the origin channel after switching away and back',
        {tag: ['@messaging']},
        async ({pw}) => {
            const {userClient, team, user} = await pw.initSetup();
            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'off-topic');
            await channelsPage.toBeVisible();

            const originDraft = `origin-draft-${pw.random.id()}`;
            const destinationMessage = `town-square-${pw.random.id()}`;

            // # Type a draft in Off-Topic and do not send it
            await channelsPage.centerView.postCreate.writeMessage(originDraft);

            // # Switch to Town Square via the sidebar
            await channelsPage.sidebarLeft.goToItem('town-square');
            await channelsPage.centerView.header.toHaveTitle('Town Square');

            // * Destination composer must not inherit the origin draft
            expect(await channelsPage.centerView.postCreate.getInputValue()).toBe('');

            // * Origin draft was persisted: the channel pencil is in the DOM
            // (often CSS-hidden until hover) and the Drafts sidebar link appears
            await expect(channelsPage.sidebarLeft.item('off-topic').getByTestId('draftIcon')).toHaveCount(1);
            await channelsPage.sidebarLeft.draftsVisible();

            // # Send a different message from Town Square
            await channelsPage.centerView.postCreate.writeMessage(destinationMessage);
            await channelsPage.centerView.postCreate.sendMessage();

            // # Return to Off-Topic
            await channelsPage.sidebarLeft.goToItem('off-topic');
            await channelsPage.centerView.header.toHaveTitle('Off-Topic');

            // * Origin draft is still in the composer
            expect(await channelsPage.centerView.postCreate.getInputValue()).toBe(originDraft);

            // # Send the restored draft
            await channelsPage.centerView.postCreate.sendMessage();

            const offTopic = await userClient.getChannelByName(team.id, 'off-topic');
            const townSquare = await userClient.getChannelByName(team.id, 'town-square');
            const has = (pl: PostList, m: string) =>
                Object.values(pl.posts ?? {}).some((p) => p.message.includes(m));

            await expect
                .poll(
                    async () => {
                        const [offTopicPosts, townSquarePosts] = await Promise.all([
                            userClient.getPosts(offTopic.id, 0, 30),
                            userClient.getPosts(townSquare.id, 0, 30),
                        ]);
                        return {
                            originDraftInOffTopic: has(offTopicPosts, originDraft),
                            originDraftInTownSquare: has(townSquarePosts, originDraft),
                            destinationInTownSquare: has(townSquarePosts, destinationMessage),
                            destinationInOffTopic: has(offTopicPosts, destinationMessage),
                        };
                    },
                    {timeout: 15000},
                )
                .toEqual({
                    originDraftInOffTopic: true,
                    originDraftInTownSquare: false,
                    destinationInTownSquare: true,
                    destinationInOffTopic: false,
                });
        },
    );

    test(
        'sending /msg to an existing DM clears the origin draft instead of restoring it',
        {tag: ['@slash_commands', '@messaging']},
        async ({pw}) => {
            const {adminClient, userClient, team, user} = await pw.initSetup();
            const [target] = await adminClient.createUsers(team.id, 1, 'draft-msg');

            // Pre-create the DM so the redirect is the same fast path as the
            // stale-draft bug: no createDirectChannel round trip.
            await userClient.createDirectChannel([user.id, target.id]);

            const {channelsPage, page} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'off-topic');
            await channelsPage.toBeVisible();

            const executePromise = page.waitForResponse(
                (r) => r.url().includes('/api/v4/commands/execute') && r.request().method() === 'POST',
            );

            // Trailing space dismisses the @mention autocomplete.
            await channelsPage.centerView.postCreate.writeMessage(`/msg @${target.username} `);
            await channelsPage.centerView.postCreate.sendMessage();
            await executePromise;

            await channelsPage.centerView.header.toHaveTitle(target.username);
            await expect(page).toHaveURL(new RegExp(`/${team.name}/messages/@${target.username}`));

            // * Destination composer is empty — it did not adopt the /msg text
            expect(await channelsPage.centerView.postCreate.getInputValue()).toBe('');

            // # Return to Off-Topic
            await channelsPage.sidebarLeft.goToItem('off-topic');
            await channelsPage.centerView.header.toHaveTitle('Off-Topic');

            // * Origin draft was cleared by the submit, not left behind as /msg
            expect(await channelsPage.centerView.postCreate.getInputValue()).toBe('');
            await expect(channelsPage.sidebarLeft.item('off-topic').getByTestId('draftIcon')).toHaveCount(0);
        },
    );
});
