// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, expect, settle, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify clicking a reaction removes the user's own reaction and clicking it again adds it back,
 * each saved on the server.
 */
test('removes and re-adds a reaction by clicking it', {tag: '@messaging'}, async ({pw}) => {
    const {adminClient, adminUser, team, user, userClient} = await pw.initSetup();
    const channel = await adminClient.createPublicChannel(team.id, `Reactions ${pw.random.id()}`);
    await adminClient.addToChannel(user.id, channel.id);
    const post = await userClient.createPost({channel_id: channel.id, message: `react ${pw.random.id()}`});
    await userClient.addReaction(user.id, post.id, 'smile');
    await adminClient.addReaction(adminUser.id, post.id, 'smile');

    // # Log in and open the channel
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});

    // * The post shows the reaction from both users
    const reaction = app.center.postList.post(post).reactions.reaction(0);
    await expect(reaction).toContainText('2');

    // # Click the reaction to remove the user's own
    await settle(reaction, {wait: Api.DeleteReaction}).click();

    // * One reaction is left, and the server no longer has the user's
    await expect(reaction).toContainText('1');
    expect((await userClient.getReactionsForPost(post.id)).map((r) => r.user_id)).toEqual([adminUser.id]);

    // # Click it again to add the user's reaction back
    const saved = await settle(reaction, {wait: Api.SaveReaction}).click();

    // * The server saved the user's reaction, and the count is back to two
    expect(saved).toMatchObject({user_id: user.id, post_id: post.id, emoji_name: 'smile'});
    await expect(reaction).toContainText('2');
});
