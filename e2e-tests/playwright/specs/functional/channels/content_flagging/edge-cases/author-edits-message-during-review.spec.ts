// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

import {createPost, verifyAuthorNotification, setupContentFlagging} from './../support';

/** @objective Verify Post message is updated for the reviewer, if author updates the post before reviewer\'s action
 * @testcase
 * 1. Setup Content Flagging with reviewers
 * 2. Create a post by User A
 * 3. Flag the post by User B
 * 4. Edit the post by User A before reviewer's action
 * 5. Login as Reviewer and verify the updated message in Content Review page
 */
test("Verify Post message is updated for the reviewer, if author updates the post before reviewer's action ", async ({
    pw,
}) => {
    const {adminClient, team, user, userClient, adminUser} = await pw.initSetup();

    // Create second user and add to team
    const secondUser = await pw.random.user('reviewer');
    const {id: secondUserID} = await adminClient.createUser(secondUser, '', '');
    await adminClient.addToTeam(team.id, secondUserID);

    // Setup content flagging *after* roles are set
    await setupContentFlagging(adminClient, [adminUser.id, secondUserID], true, false);

    const message = `Post by @${user.username}, is flagged once`;

    const {post} = await createPost(adminClient, userClient, team, user, message);
    await adminClient.flagPost(post.id, 'Inappropriate content', 'This message is inappropriate');

    let updatedMessage = `${message} - Edited during review`;
    await userClient.updatePost({
        id: post.id,
        create_at: post.create_at,
        update_at: Date.now(),
        edit_at: 0,
        delete_at: 0,
        is_pinned: false,
        user_id: post.user_id,
        channel_id: post.channel_id,
        root_id: '',
        original_id: '',
        message: updatedMessage,
        type: '',
        props: {},
        hashtags: '',
        file_ids: [],
        pending_post_id: '',
        remote_id: '',
        reply_count: 0,
        last_reply_at: 0,
        participants: null,
        metadata: post.metadata,
    });

    const {channelsPage: secondChannelsPage, contentReviewPage: secondContentReviewPage} =
        await pw.testBrowser.login(secondUser);

    // The edited post will have Edited indicator automatically added by the system
    updatedMessage = `${updatedMessage} Edited`;
    await verifyAuthorNotification(
        post.id,
        secondChannelsPage,
        secondContentReviewPage,
        team.name,
        updatedMessage,
        'Pending',
    );
});
