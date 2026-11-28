// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that a user viewing a thread in the right-hand side can no longer reply once they are
 * removed from the channel.
 */
test(
    'MM-T843 removes the reply box in the right-hand side after the user is removed from the channel',
    {tag: '@channel_settings'},
    async ({pw}) => {
        const {adminClient, team, user} = await pw.initSetup();

        // # Create a channel, add the user, and post a root message as the admin
        const channel = await adminClient.createPublicChannel(team.id, `Remove ${pw.random.id()}`);
        await adminClient.addToChannel(user.id, channel.id);
        const root = await adminClient.createPost({channel_id: channel.id, message: `root ${pw.random.id()}`});

        // # Log in as the user and open the thread in the right-hand side
        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel});
        const rootPost = app.center.postList.post(root);
        await rootPost.locator.hover();
        await rootPost.menu.replyButton.click();
        await expect(app.rhs.postCreate.message.container).toBeVisible();

        // # Post a reply in the right-hand side
        const composer = app.rhs.postCreate;
        await composer.message.container.fill(`reply ${pw.random.id()}`);
        await composer.sendButton.click();

        // * The reply is in the thread, and the reply box is available before removal
        await expect.poll(async () => (await app.rhs.thread.postList.keys()).length).toBe(2);
        await expect(composer.message).toBeVisible();

        // # Remove the user from the channel
        await adminClient.removeFromChannel(user.id, channel.id);

        // * The reply box in the right-hand side is no longer available
        await expect(composer.message).not.toBeVisible({timeout: pw.duration.ten_sec});
    },
);

/**
 * @objective Verify that users added to a public channel in one batch are combined into a single system
 * message, while a user added after an intervening post produces a separate system message.
 */
test(
    'MM-T858 combines consecutive join messages and separates them across posts',
    {tag: '@channel_settings'},
    async ({pw}) => {
        const {adminClient, team, user, userClient} = await pw.initSetup();
        const [member1, member2, member3] = await adminClient.createUsers(team.id, 3, 'join-leave');
        const channel = await adminClient.createPublicChannel(team.id, `Messages ${pw.random.id()}`);
        await adminClient.addToChannel(user.id, channel.id);

        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel});
        const postList = app.center.postList;
        const lastPostText = async () => {
            const keys = await postList.postList.keys();
            return keys.length ? postList.post({id: keys[keys.length - 1]}).locator.innerText() : '';
        };

        // # Post a message to seal the setup system messages into their own group
        const setup = await userClient.createPost({channel_id: channel.id, message: `setup ${pw.random.id()}`});
        await expect(postList.post(setup).locator).toBeVisible();

        // # Add two members to the channel in quick succession
        await adminClient.addToChannel(member1.id, channel.id);
        await adminClient.addToChannel(member2.id, channel.id);

        // * Both members are combined into a single "added to the channel" system message
        await expect.poll(lastPostText).toContain('added to the channel');
        await expect.poll(lastPostText).toContain(member1.username);
        expect(await lastPostText()).toContain(member2.username);

        // # Post a message, then add a third member after it
        const divider = await userClient.createPost({channel_id: channel.id, message: `divider ${pw.random.id()}`});
        await expect(postList.post(divider).locator).toBeVisible();
        await adminClient.addToChannel(member3.id, channel.id);

        // * The third member gets a separate system message that doesn't include the earlier members
        await expect.poll(lastPostText).toContain(member3.username);
        expect(await lastPostText()).toContain('added to the channel');
        expect(await lastPostText()).not.toContain(member1.username);
    },
);
