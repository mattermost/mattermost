// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PostList} from '@mattermost/types/posts';

import {expect, test} from '@mattermost/playwright-lib';

/**
 * Reproducer for the `/msg @user` stale-draft bug.
 *
 * `doSubmit` clears the composer draft *after* awaiting the submit, stamping it
 * with the `channelId` captured when the submit began (the origin channel). For
 * an EXISTING DM, `openDirectChannelToUserId` needs no network call, so the
 * channel switch — and the effect that resyncs the draft — both complete during
 * that await. The stale write therefore lands last and is never corrected, so
 * every later message routes to the origin channel no matter how long the user
 * waits. A NEW DM hides the bug because `createDirectChannel`'s round trip
 * pushes the switch after the stale write.
 *
 * @objective Verify a message typed after a settled `/msg` redirect to an
 * existing DM posts to the DM, not the origin channel.
 */
test.describe('/msg redirect to an existing DM', () => {
    test(
        'posts a later message to the DM rather than the origin channel',
        {tag: ['@slash_commands', '@messaging']},
        async ({pw}) => {
            const {adminClient, userClient, team, user} = await pw.initSetup();
            const [target] = await adminClient.createUsers(team.id, 1, 'stale-dm');

            // Make the DM pre-exist so openDirectChannelToUserId short-circuits
            // without a network round trip. This is what triggers the bug.
            const dmChannel = await userClient.createDirectChannel([user.id, target.id]);
            await userClient.createPost({
                channel_id: dmChannel.id,
                message: 'seeding the existing DM',
            } as Parameters<typeof userClient.createPost>[0]);

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

            // Let the redirect fully settle. Any timing window is long closed;
            // what remains is the stale draft.channelId.
            await channelsPage.centerView.header.toHaveTitle(target.username);
            await expect(page).toHaveURL(new RegExp(`/${team.name}/messages/@${target.username}`));
            await pw.wait(3000);

            const message = `stale-draft-${pw.random.id()}`;
            await channelsPage.centerView.postCreate.writeMessage(message);
            await channelsPage.centerView.postCreate.sendMessage();

            const offTopic = await userClient.getChannelByName(team.id, 'off-topic');
            const has = (pl: PostList, m: string) =>
                Object.values(pl.posts ?? {}).some((p) => p.message.includes(m));

            await expect
                .poll(
                    async () => {
                        const [offTopicPosts, dmPosts] = await Promise.all([
                            userClient.getPosts(offTopic.id, 0, 30),
                            userClient.getPosts(dmChannel.id, 0, 30),
                        ]);
                        return {
                            inOffTopic: has(offTopicPosts, message),
                            inDm: has(dmPosts, message),
                        };
                    },
                    {timeout: 15000},
                )
                .toEqual({inOffTopic: false, inDm: true});
        },
    );
});
