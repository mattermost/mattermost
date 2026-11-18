// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';

import {test} from '@mattermost/playwright-lib';

import {createPost, verifyReporterNotification} from './../support';

async function setupContentFlagging(adminClient: Client4, userIds: string[], enable = true) {
    await adminClient.patchConfig({
        ContentFlaggingSettings: {
            EnableContentFlagging: enable,
            ReviewerSettings: {
                CommonReviewers: true,
                SystemAdminsAsReviewers: true,
                TeamAdminsAsReviewers: true,
                CommonReviewerIds: userIds,
            },
            NotificationSettings: {
                EventTargetMapping: {
                    assigned: ['reviewers', 'author'],
                    dismissed: ['reporter', 'author', 'reviewers'],
                    flagged: ['reviewers', 'author'],
                    removed: ['author', 'reporter', 'reviewers'],
                },
            },
            AdditionalSettings: {
                HideFlaggedContent: true,
            },
        },
    });
    return adminClient;
}

/**
 * @objective Verify Author is notified if the post is flagged in a channel
 */
test('Verify Author is notified if the post is flagged in a channel', async ({pw}) => {
    const {adminClient, team, user, userClient} = await pw.initSetup();
    await setupContentFlagging(adminClient, [user.id]);

    const message = `Post by @${user.username}, is flagged once`;
    const {post, townSquare} = await createPost(adminClient, userClient, team, user, message);
    await adminClient.flagPost(post.id, 'Classification mismatch', 'This message is inappropriate');

    const {app} = await pw.testBrowser.login(user);
    const expected = `Your post having ID ${post.id} in the channel ${townSquare.display_name} has been quarantined for review.`;
    await verifyReporterNotification(app, team, expected);
});

/**
 * @objective Verify Author is notified if flagged post is Retained by the reviewer
 */
test('Verify Author is notified if flagged post is Retained in a channel', async ({pw}) => {
    const {adminClient, team, user, userClient} = await pw.initSetup();
    await setupContentFlagging(adminClient, [user.id]);

    const message = `Post by @${user.username}, is flagged once`;
    const {post, townSquare} = await createPost(adminClient, userClient, team, user, message);
    await adminClient.flagPost(post.id, 'Classification mismatch', 'This message is inappropriate');
    await adminClient.keepFlaggedPost(post.id, 'Retaining this post after review');

    const {app} = await pw.testBrowser.login(user);
    const expected = `Your post having ID ${post.id} in the channel ${townSquare.display_name} which was quarantined for review has been restored by a reviewer.`;
    await verifyReporterNotification(app, team, expected);
});

/**
 * @objective Verify Author is notified if flagged post is Removed by the reviewer
 */
test('Verify Author is notified if flagged post is Removed from a channel', async ({pw}) => {
    const {adminClient, team, user, userClient} = await pw.initSetup();
    await setupContentFlagging(adminClient, [user.id]);

    const message = `Post by @${user.username}, is flagged once`;
    const {post, townSquare} = await createPost(adminClient, userClient, team, user, message);
    await adminClient.flagPost(post.id, 'Classification mismatch', 'This message is inappropriate');
    await adminClient.removeFlaggedPost(post.id, 'Removing this post after review');

    const {app} = await pw.testBrowser.login(user);
    const expected = `Your post having ID ${post.id} in the channel ${townSquare.display_name} which was quarantined for review has been permanently removed by a reviewer.`;
    await verifyReporterNotification(app, team, expected);
});
