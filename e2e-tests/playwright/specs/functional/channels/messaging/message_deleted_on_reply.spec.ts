// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, Msg} from '@mattermost/playwright-lib';

/**
 * @objective Verify deleting a root post while another user drafts a reply removes the original message and does not send the draft.
 */
test(
    'MM-T113 Delete a message during reply and show the other user a message deleted placeholder',
    {tag: '@messaging'},
    async ({pw}) => {
        const {adminClient, team, user} = await pw.initSetup();
        const [author] = await adminClient.createUsers(team.id, 1, 'deleted-reply-author');
        const channel = await adminClient.createPublicChannel(team.id, 'Deleted While Replying');
        await adminClient.addToChannel(user.id, channel.id);
        await adminClient.addToChannel(author.id, channel.id);
        const message = `root-${pw.random.id()}`;
        const draftMessage = `draft-${pw.random.id()}`;

        // # The author posts the root (adminClient would post as the admin, whatever user_id says)
        const {client: authorClient} = await pw.makeClient({username: author.username, password: author.password});
        const root = await authorClient.createPost({channel_id: channel.id, message});

        // # Log in as the other user, open the root's thread, and type a reply without sending it
        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel});
        const centerRoot = app.center.postList.post(root);
        await centerRoot.container.hover();
        await centerRoot.menu.replyButton.click();
        await expect(app.rhs.postCreate.message.container).toBeVisible();
        const threadRoot = app.rhs.thread.post(root);
        await expect(threadRoot.message.container).toHaveText(message);
        await app.rhs.postCreate.message.container.fill(draftMessage);
        await expect(app.rhs.postCreate.message.container).toHaveValue(draftMessage);

        // # The author deletes the root
        await authorClient.deletePost(root.id);

        // * The other user sees the placeholder instead of the message, in the center and in the thread
        await expect(centerRoot.message.container).toHaveMessage(Msg.post_body.deleted);
        await expect(threadRoot.message.container).toHaveMessage(Msg.post_body.deleted);

        // * The draft wasn't sent: the thread still holds only the root
        expect(await app.rhs.thread.postList.keys()).toEqual([root.id]);

        // # Log in as the author and revisit the channel
        const {app: authorApp} = await pw.testBrowser.login(author);
        await authorApp.channelsPage.goto({team, channel});

        // * The deleted post's message is gone
        await expect(authorApp.center.postList).toBeVisible();
        await expect(authorApp.center.postList).not.toContainText(message);
    },
);
