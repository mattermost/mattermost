// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Constants for repeated strings used across the flag-message specs.
export const FLAG_REASON_CLASSIFICATION_MISMATCH: string = 'Classification Mismatch';
export const FLAG_REASON_CLASSIFICATION_MISMATCH_ALT: string = 'Classification mismatch';
export const FLAG_COMMENT: string = 'This message contains misclassified data';

/**
 * Returns the system message that replaces a quarantined post for the
 * given author. Kept as a factory so tests can pass any username.
 */
export const systemMessageForQuarantined = (username: string): string =>
    `The message from @${username} has been quarantined for review. You will be notified once it is reviewed by a Reviewer.`;

/**
 * Log in as `user`, optionally navigate to `teamName/channelName` (defaults
 * to the landing page via `channelsPage.goto()`), and wait for the page to
 * be visible.
 */
export async function loginAndNavigate(pw: any, user: any, teamName?: string, channelName?: string): Promise<any> {
    const {channelsPage} = await pw.testBrowser.login(user);
    if (teamName && channelName) {
        await channelsPage.goto(teamName, channelName);
    } else {
        await channelsPage.goto();
    }
    await channelsPage.toBeVisible();
    return channelsPage;
}

/**
 * Post a message in the current channel and return the resulting post
 * object along with its post ID.
 */
export async function postMessage(channelsPage: any, message: string): Promise<{post: any; postId: any}> {
    await channelsPage.postMessage(message);
    const post = await channelsPage.getLastPost();
    const postId = await channelsPage.centerView.getLastPostID();
    return {post, postId};
}

/**
 * Hover a post and open its dot menu, waiting for the menu to be visible.
 */
export async function openPostDotMenu(post: any, channelsPage: any): Promise<void> {
    await post.hover();
    await post.postMenu.toBeVisible();
    await post.postMenu.dotMenuButton.click();
    await channelsPage.postDotMenu.toBeVisible();
}

/**
 * Drive the full flag-post flow from an unopened dot menu through to
 * submission. Dialog is expected to close (`notToBeVisible`) on success.
 */
export async function flagPostFlow(
    post: any,
    channelsPage: any,
    message: string,
    reason: string = FLAG_REASON_CLASSIFICATION_MISMATCH,
    comment: string = FLAG_COMMENT,
): Promise<void> {
    await openPostDotMenu(post, channelsPage);
    await channelsPage.postDotMenu.flagMessageMenuItem.click();
    await channelsPage.centerView.flagPostConfirmationDialog.toBeVisible();
    await channelsPage.centerView.flagPostConfirmationDialog.toContainPostText(message);
    await channelsPage.centerView.flagPostConfirmationDialog.selectFlagReason(reason);
    await channelsPage.centerView.flagPostConfirmationDialog.fillFlagComment(comment);
    await channelsPage.centerView.flagPostConfirmationDialog.submitButton.click();
    await channelsPage.centerView.flagPostConfirmationDialog.notToBeVisible();
}
