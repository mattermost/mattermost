// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, expect, generated, Msg, settle, test, DefaultChannel} from '@mattermost/playwright-lib';

/**
 * @objective Verify a thread the user follows is listed in Threads, opens in the thread pane, and leaves
 * the list once unfollowed from the pane's thread menu (an open thread stays until the user leaves it).
 */
test(
    'lists a followed thread, opens it, and drops it from the list once unfollowed from the thread menu and left',
    {tag: '@collapsed_reply_threads'},
    async ({pw}) => {
        const {adminClient, team, user, userClient} = await pw.initSetup();

        // # Threads need collapsed reply threads (an earlier spec may have turned them off on this server)
        await adminClient.patchConfig({ServiceSettings: {CollapsedThreads: 'always_on'}} as any);
        const channel = await userClient.getChannelByName(team.id, DefaultChannel.TownSquare);

        // # Start a thread: the author follows it
        const root = await userClient.createPost({channel_id: channel.id, message: 'Thread root'} as any);
        await userClient.createPost({channel_id: channel.id, root_id: root.id, message: 'First reply'} as any);

        // # Log in and open Threads
        const {app, page} = await pw.testBrowser.login(user);
        await app.threadsPage.goto({team});

        // * The thread is listed under its root post, by its author
        const item = app.threads.feed.thread(0);
        await expect(item).toBeVisible();
        await expect(item.authorText).toHaveText(user.username);

        // # Open it
        await item.container.click();

        // * The pane shows the thread, and the URL names it
        await expect(page).toHavePath(generated.ThreadsPage.path({team, threadIdentifier: root.id}));
        await expect(app.threads.pane.followButton).toHaveMessage(Msg.threading.following);

        // # Unfollow it from the pane's thread menu
        await app.threads.pane.openMenuButton.click();
        await expect(app.threadMenu.followThreadMenuItem).toBeVisible();
        await settle(app.threadMenu.followThreadMenuItem, {wait: Api.StopFollowingThread}).click();

        // # Leave it for the Threads list (an open thread stays in the list until the user leaves it)
        await app.threadsPage.goto({team});

        // * The thread is no longer in the followed list
        await expect(item.locator).toBeHidden();
    },
);
