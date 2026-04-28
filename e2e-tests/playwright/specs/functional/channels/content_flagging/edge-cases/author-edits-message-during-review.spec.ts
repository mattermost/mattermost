// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {createPost, setupContentFlagging} from './../support';

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
    // Promote to system_admin so SystemAdminsAsReviewers: true covers them even if a
    // concurrent test's setupContentFlagging overwrites CommonReviewerIds.
    await adminClient.updateUserRoles(secondUserID, 'system_user system_admin');

    // Setup content flagging *after* roles are set
    await setupContentFlagging(adminClient, [adminUser.id, secondUserID], true, false);

    const message = `Post by @${user.username}, is flagged once`;

    const {post} = await createPost(adminClient, userClient, team, user, message);
    // Re-apply guard: concurrent initSetup() may reset EnableContentFlagging between setup and flagPost
    await setupContentFlagging(adminClient, [adminUser.id, secondUserID], true, false);
    await pw.waitUntil(async () => {
        const cfg = await adminClient.getConfig();
        return cfg.ContentFlaggingSettings?.EnableContentFlagging === true;
    });
    await adminClient.flagPost(post.id, 'Classification mismatch', 'This message is inappropriate');

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

    await setupContentFlagging(adminClient, [adminUser.id, secondUserID], true, false);
    await pw.waitUntil(async () => {
        const cfg = await adminClient.getConfig();
        return cfg.ContentFlaggingSettings?.EnableContentFlagging === true;
    });

    const {channelsPage: secondChannelsPage, contentReviewPage: secondContentReviewPage} =
        await pw.testBrowser.login(secondUser);

    // The edited post will have Edited indicator automatically added by the system
    updatedMessage = `${updatedMessage} Edited`;

    // Navigate to @content-review DM then wait for the DataSpillageReport card with
    // a resilient polling loop. Concurrent initSetup() calls from other test workers
    // can reset EnableContentFlagging=false at any moment — causing the DM to render
    // without cards. Each poll iteration re-applies the config and reloads the page so
    // the UI always sees EnableContentFlagging=true when it renders.
    await secondChannelsPage.goto(team.name, '@content-review');
    await secondChannelsPage.toBeVisible();
    await secondContentReviewPage.setReportCardByPostID(post.id);

    await expect
        .poll(
            async () => {
                await setupContentFlagging(adminClient, [adminUser.id, secondUserID], true, false);
                await secondChannelsPage.page.reload();
                await secondChannelsPage.toBeVisible();
                return secondChannelsPage.page
                    .locator('div.DataSpillageReport')
                    .filter({has: secondChannelsPage.page.locator(`#postMessageText_${post.id}`)})
                    .or(secondChannelsPage.page.locator('div.DataSpillageReport').first())
                    .isVisible()
                    .catch(() => false);
            },
            {timeout: 30000, intervals: [1000, 2000, 2000, 2000, 2000, 2000, 2000]},
        )
        .toBe(true);

    // Card is visible — verify the updated message and review status immediately
    // while the page is still in the same EnableContentFlagging=true render.
    await secondContentReviewPage.verifyFlaggedPostStatus('Pending');
    await secondContentReviewPage.verifyFlaggedPostReason('Classification mismatch');
    await secondContentReviewPage.verifyFlaggedPostMessage(updatedMessage);
});
