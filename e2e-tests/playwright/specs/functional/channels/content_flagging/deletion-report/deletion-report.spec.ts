// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

import {setupContentFlagging, createPost} from './../support';

/**
 * @objective Verify that a deletion report summary is posted to the reviewer's content review thread after removing a flagged post
 * @testcase
 * 1. Create two users and set one as reviewer
 * 2. Setup content flagging
 * 3. Create a post, flag it, and remove it via reviewer
 * 4. Login as the reviewer and navigate to the content review DM
 * 5. Verify the deletion report summary table is posted in the reviewer's thread
 */
test('Reviewer receives a deletion report summary after removing a flagged post', async ({pw}) => {
    const {adminClient, team, user: reviewerUser} = await pw.initSetup();

    // Create author user..
    const authorUser = await pw.random.user('author');
    const {id: authorUserID} = await adminClient.createUser(authorUser, '', '');
    await adminClient.addToTeam(team.id, authorUserID);
    const {client: authorUserClient} = await pw.makeClient(authorUser);

    await setupContentFlagging(adminClient, [reviewerUser.id]);

    const message = `Sensitive 2 post by @${authorUser.username} to be removed`;
    const {post} = await createPost(adminClient, authorUserClient, team, authorUser, message);

    // Flag the post
    await adminClient.flagPost(post.id, 'Classification mismatch', 'This message contains sensitive data');

    // Login as reviewer and navigate to content review DM
    const {channelsPage, contentReviewPage} = await pw.testBrowser.login(reviewerUser);
    await channelsPage.goto(team.name, '@content-review');
    await channelsPage.toBeVisible();

    const lastPost = await channelsPage.centerView.getLastPost();
    await lastPost.toContainText(message);

    // Remove the post via the UI. The remove flow still routes through the
    // skip-confirm step (destructive action), unlike the keep flow which now
    // bypasses it.
    await contentReviewPage.setReportCardByPostID(post.id);
    await contentReviewPage.openViewDetails();
    await contentReviewPage.waitForRHSVisible();
    await contentReviewPage.openViewDetails();
    await contentReviewPage.clickRemoveMessage();
    await contentReviewPage.enterConfirmationComment('Removing: data spillage confirmed');
    await contentReviewPage.confirmRemoveWithoutReport();

    await channelsPage.goto(team.name, '@content-review');
    await channelsPage.toBeVisible();

    await lastPost.toContainText('Content deleted as part of Content Flagging review process');

    const viewDetailButton = await channelsPage.getFlaggedPostViewDetailButton(post.id);
    await viewDetailButton.click();

    await channelsPage.sidebarRight.toBeVisible();

    // Verify the summary table headers are present (rendered as markdown table)
    await channelsPage.sidebarRight.toContainText('Step');
    await channelsPage.sidebarRight.toContainText('Status');
    await channelsPage.sidebarRight.toContainText('Detail');

    await channelsPage.sidebarRight.toContainText('File attachments');
    await channelsPage.sidebarRight.toContainText('File attachment records');
    await channelsPage.sidebarRight.toContainText('Edit history');
    await channelsPage.sidebarRight.toContainText('Priority metadata');
    await channelsPage.sidebarRight.toContainText('Persistent notifications');
    await channelsPage.sidebarRight.toContainText('Acknowledgements');
    await channelsPage.sidebarRight.toContainText('Reminders');
    await channelsPage.sidebarRight.toContainText('Thread, replies, and reactions');
    await channelsPage.sidebarRight.toContainText('Post record');

    // Verify file attachment is present with the expected filename pattern
    const expectedFileName = `deletion_report_${post.id}.md`;
    await channelsPage.sidebarRight.toContainText(expectedFileName, 30000);
});
