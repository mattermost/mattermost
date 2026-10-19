// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

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
        const root = await adminClient.createPost({channel_id: channel.id, user_id: author.id, message});

        // # Log in as the other user, open the root thread, and type an unsent draft
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();
        const centerRoot = await channelsPage.centerView.getPostById(root.id);
        await centerRoot.reply();
        await channelsPage.sidebarRight.toBeVisible();
        await channelsPage.sidebarRight.postCreate.writeMessage(draftMessage);
        const rhsRoot = await channelsPage.sidebarRight.getPostById(root.id);

        // # Delete the root post as its author
        await adminClient.deletePost(root.id);

        // * Verify the other user sees a deleted-message placeholder without the original message
        await centerRoot.toBeDeleted(message);
        await rhsRoot.toBeDeleted(message);

        // * Verify the draft was not sent as a reply
        const lastRhsPost = await channelsPage.sidebarRight.getLastPost();
        await lastRhsPost.toNotContainText(draftMessage);

        // # Log in as the author and revisit the channel
        const {channelsPage: authorChannelsPage} = await pw.testBrowser.login(author);
        await authorChannelsPage.goto(team.name, channel.name);
        await authorChannelsPage.toBeVisible();

        // * Verify the deleted post's original message is absent
        await authorChannelsPage.toNotContainText(message);
    },
);
