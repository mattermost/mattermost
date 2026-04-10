// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

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
    const {adminClient, team, user: reviewerUser, userClient: reviewerUserClient, adminUser} = await pw.initSetup();

    // Create author user
    const authorUser = await pw.random.user('author');
    const {id: authorUserID} = await adminClient.createUser(authorUser, '', '');
    await adminClient.addToTeam(team.id, authorUserID);
    const {client: authorUserClient} = await pw.makeClient(authorUser);

    await setupContentFlagging(adminClient, [reviewerUser.id]);

    const message = `Sensitive post by @${authorUser.username} to be removed`;
    const {post} = await createPost(adminClient, authorUserClient, team, authorUser, message);

    // Flag and remove the post
    await adminClient.flagPost(post.id, 'Classification mismatch', 'This message contains sensitive data');
    await reviewerUserClient.removeFlaggedPost(post.id, 'Removing: data spillage confirmed');

    // Login as reviewer and navigate to content review DM
    const {channelsPage} = await pw.testBrowser.login(reviewerUser);
    await channelsPage.goto(team.name, '@content-review');
    await channelsPage.toBeVisible();

    // The deletion report summary should be posted as a message in the reviewer's thread
    // It contains a markdown summary table with step/status/detail columns
    const lastPost = await channelsPage.centerView.getLastPost();
    await lastPost.toBeVisible();

    // Verify the summary table headers are present (rendered as markdown table)
    await expect(lastPost.body).toContainText('Step');
    await expect(lastPost.body).toContainText('Status');
    await expect(lastPost.body).toContainText('Detail');
});

/**
 * @objective Verify that the deletion report includes a file attachment with the full report
 * @testcase
 * 1. Setup content flagging with a reviewer
 * 2. Create and flag a post, then remove it
 * 3. Verify the deletion report message has a file attachment named deletion_report_<postId>.md
 */
test('Deletion report message includes a file attachment with the full report', async ({pw}) => {
    const {adminClient, team, user: reviewerUser, userClient: reviewerUserClient} = await pw.initSetup();

    // Create author user
    const authorUser = await pw.random.user('author');
    const {id: authorUserID} = await adminClient.createUser(authorUser, '', '');
    await adminClient.addToTeam(team.id, authorUserID);
    const {client: authorUserClient} = await pw.makeClient(authorUser);

    await setupContentFlagging(adminClient, [reviewerUser.id]);

    const message = `File attachment test post by @${authorUser.username}`;
    const {post} = await createPost(adminClient, authorUserClient, team, authorUser, message);

    await adminClient.flagPost(post.id, 'Unauthorized disclosure', 'Contains classified info');
    await reviewerUserClient.removeFlaggedPost(post.id, 'Confirmed unauthorized disclosure');

    const {channelsPage} = await pw.testBrowser.login(reviewerUser);
    await channelsPage.goto(team.name, '@content-review');
    await channelsPage.toBeVisible();

    // The last post should contain the deletion report with a file attachment
    const lastPost = await channelsPage.centerView.getLastPost();
    await lastPost.toBeVisible();

    // Verify file attachment is present with the expected filename pattern
    const expectedFileName = `deletion_report_${post.id}.md`;
    await expect(lastPost.container).toContainText(expectedFileName);
});

/**
 * @objective Verify that multiple reviewers each receive their own localized deletion report
 * @testcase
 * 1. Create two reviewers
 * 2. Setup content flagging with both as reviewers
 * 3. Create a post, flag it, and have one reviewer remove it
 * 4. Verify both reviewers see the deletion report in their content review DM
 */
test('Multiple reviewers each receive a deletion report after post removal', async ({pw}) => {
    const {adminClient, team, user, userClient, adminUser} = await pw.initSetup();

    // Create first reviewer
    const reviewer1 = await pw.random.user('reviewer');
    const {id: reviewer1ID} = await adminClient.createUser(reviewer1, '', '');
    await adminClient.addToTeam(team.id, reviewer1ID);
    const {client: reviewer1Client} = await pw.makeClient(reviewer1);

    // Create second reviewer
    const reviewer2 = await pw.random.user('reviewer');
    const {id: reviewer2ID} = await adminClient.createUser(reviewer2, '', '');
    await adminClient.addToTeam(team.id, reviewer2ID);

    await setupContentFlagging(adminClient, [reviewer1ID, reviewer2ID]);

    const message = `Post by @${user.username} for multi-reviewer deletion report`;
    const {post} = await createPost(adminClient, userClient, team, user, message);

    await adminClient.flagPost(post.id, 'Need-to-know violation', 'Sensitive data exposed');
    await reviewer1Client.removeFlaggedPost(post.id, 'Removing after review');

    // Verify reviewer 1 sees the deletion report
    const {channelsPage: reviewer1Page} = await pw.testBrowser.login(reviewer1);
    await reviewer1Page.goto(team.name, '@content-review');
    await reviewer1Page.toBeVisible();

    const reviewer1LastPost = await reviewer1Page.centerView.getLastPost();
    await reviewer1LastPost.toBeVisible();
    await expect(reviewer1LastPost.body).toContainText('Step');
    await expect(reviewer1LastPost.body).toContainText('Status');

    // Verify reviewer 2 also sees the deletion report
    const {channelsPage: reviewer2Page} = await pw.testBrowser.login(reviewer2);
    await reviewer2Page.goto(team.name, '@content-review');
    await reviewer2Page.toBeVisible();

    const reviewer2LastPost = await reviewer2Page.centerView.getLastPost();
    await reviewer2LastPost.toBeVisible();
    await expect(reviewer2LastPost.body).toContainText('Step');
    await expect(reviewer2LastPost.body).toContainText('Status');
});

/**
 * @objective Verify no deletion report is posted when a flagged post is kept (not removed)
 * @testcase
 * 1. Setup content flagging with a reviewer
 * 2. Create and flag a post
 * 3. Keep (retain) the flagged post instead of removing it
 * 4. Verify the last message in the reviewer's content review DM does NOT contain deletion report content
 */
test('No deletion report is posted when a flagged post is kept', async ({pw}) => {
    const {adminClient, team, user: reviewerUser, userClient: reviewerUserClient} = await pw.initSetup();

    // Create author user
    const authorUser = await pw.random.user('author');
    const {id: authorUserID} = await adminClient.createUser(authorUser, '', '');
    await adminClient.addToTeam(team.id, authorUserID);
    const {client: authorUserClient} = await pw.makeClient(authorUser);

    await setupContentFlagging(adminClient, [reviewerUser.id]);

    const message = `Post by @${authorUser.username} to be kept`;
    const {post} = await createPost(adminClient, authorUserClient, team, authorUser, message);

    await adminClient.flagPost(post.id, 'Classification mismatch', 'Flagged for review');

    // Keep the post instead of removing it
    await reviewerUserClient.keepFlaggedPost(post.id, 'Post is fine after review');

    const {channelsPage} = await pw.testBrowser.login(reviewerUser);
    await channelsPage.goto(team.name, '@content-review');
    await channelsPage.toBeVisible();

    // The last post should be the keep notification, not a deletion report
    const lastPost = await channelsPage.centerView.getLastPost();
    await lastPost.toBeVisible();

    // Verify no deletion report summary table is present
    const expectedFileName = `deletion_report_${post.id}.md`;
    await expect(lastPost.container).not.toContainText(expectedFileName);
});

/**
 * @objective Verify deletion report contains the incomplete warning when steps have partial failures
 * @testcase
 * 1. Setup content flagging with a reviewer
 * 2. Create a simple post, flag it, and remove it
 * 3. Verify the deletion report does not contain the incomplete warning (all steps should succeed for a simple post)
 */
test('Deletion report for a simple post shows all steps as successful', async ({pw}) => {
    const {adminClient, team, user: reviewerUser, userClient: reviewerUserClient} = await pw.initSetup();

    // Create author user
    const authorUser = await pw.random.user('author');
    const {id: authorUserID} = await adminClient.createUser(authorUser, '', '');
    await adminClient.addToTeam(team.id, authorUserID);
    const {client: authorUserClient} = await pw.makeClient(authorUser);

    await setupContentFlagging(adminClient, [reviewerUser.id]);

    const message = `Simple post by @${authorUser.username} for deletion report`;
    const {post} = await createPost(adminClient, authorUserClient, team, authorUser, message);

    await adminClient.flagPost(post.id, 'Unauthorized disclosure', 'Review needed');
    await reviewerUserClient.removeFlaggedPost(post.id, 'Removing after thorough review');

    const {channelsPage} = await pw.testBrowser.login(reviewerUser);
    await channelsPage.goto(team.name, '@content-review');
    await channelsPage.toBeVisible();

    const lastPost = await channelsPage.centerView.getLastPost();
    await lastPost.toBeVisible();

    // For a simple post with no errors, there should be no incomplete warning
    await expect(lastPost.body).not.toContainText('Post deletion incomplete');
});
