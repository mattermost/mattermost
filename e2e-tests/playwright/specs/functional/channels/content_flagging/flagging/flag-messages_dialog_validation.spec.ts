// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

import {FLAG_REASON_CLASSIFICATION_MISMATCH, loginAndNavigate, openPostDotMenu, postMessage} from './support';

/**
 * @objective: Verify Flagging reason dropdown options
 * * @testcase
 * 1. Login as a user
 * 2. Post a message
 * 3. Open flag message dialog
 * 4. Verify the flagging reason dropdown options
 */
test('Verify Flagging reason dropdown', async ({pw}) => {
    const {user, adminClient, team} = await pw.initSetup();
    await adminClient.patchConfig({
        ContentFlaggingSettings: {
            EnableContentFlagging: true,
            AdditionalSettings: {
                Reasons: ['Spam', FLAG_REASON_CLASSIFICATION_MISMATCH, 'Harassment', 'Hate Speech', 'Other'],
            },
        },
    });

    const channelsPage = await loginAndNavigate(pw, user, team.name, 'town-square');
    const message = 'This is a test message to be flagged';
    const {post} = await postMessage(channelsPage, message);

    await openPostDotMenu(post, channelsPage);
    await channelsPage.postDotMenu.flagMessageMenuItem.click();
    await channelsPage.centerView.flagPostConfirmationDialog.toBeVisible();
    await channelsPage.centerView.flagPostConfirmationDialog.toContainPostText(message);
    await channelsPage.centerView.flagPostConfirmationDialog.selectFlagReason(FLAG_REASON_CLASSIFICATION_MISMATCH);
});

/**
 * @objective: Verify Comments are required for Flagging
 * * @testcase
 * 1. Login as a user
 * 2. Post a message
 * 3. Open flag message dialog
 * 4. Verify that comments are required for flagging
 */
test('Verify Comments are required for Flagging', async ({pw}) => {
    const {user, adminClient, team} = await pw.initSetup();
    await adminClient.patchConfig({
        ContentFlaggingSettings: {
            EnableContentFlagging: true,
            AdditionalSettings: {
                Reasons: ['Spam', FLAG_REASON_CLASSIFICATION_MISMATCH, 'Harassment', 'Hate Speech', 'Other'],
                ReporterCommentRequired: true,
            },
        },
    });

    const channelsPage = await loginAndNavigate(pw, user, team.name, 'town-square');
    const message = 'This is a test message to be flagged';
    const {post} = await postMessage(channelsPage, message);

    await openPostDotMenu(post, channelsPage);
    await channelsPage.postDotMenu.flagMessageMenuItem.click();
    await channelsPage.centerView.flagPostConfirmationDialog.toBeVisible();
    await channelsPage.centerView.flagPostConfirmationDialog.toContainPostText(message);
    await channelsPage.centerView.flagPostConfirmationDialog.selectFlagReason(FLAG_REASON_CLASSIFICATION_MISMATCH);
    await channelsPage.centerView.flagPostConfirmationDialog.submitButton.click();
    await channelsPage.centerView.flagPostConfirmationDialog.toBeVisible();
    await channelsPage.centerView.flagPostConfirmationDialog.requireCommentsForFlaggingPost();
});
