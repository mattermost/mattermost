// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import BurnOnReadBadge from './burn_on_read_badge';
import BurnOnReadConcealedPlaceholder from './burn_on_read_concealed_placeholder';
import BurnOnReadTimerChip from './burn_on_read_timer_chip';
import PostMenu from './post_menu';
import ThreadFooter from './thread_footer';

// Both assert the positive case first: a lone "placeholder is absent" check also passes
// against a region that has not rendered at all.
export async function expectFilesVisible(scope: Locator) {
    await expect(scope.getByTestId('fileAttachmentList')).toBeVisible();
    await expect(scope.getByTestId('redactedFilesPlaceholder')).toHaveCount(0);
}

export async function expectFilesRedacted(scope: Locator) {
    await expect(scope.getByTestId('redactedFilesPlaceholder')).toBeVisible();
    await expect(scope.getByTestId('fileAttachmentList')).toHaveCount(0);
}

export default class ChannelsPost {
    readonly container: Locator;

    readonly body;
    readonly profileIcon;
    readonly emoticon;
    readonly messageText;
    readonly editedIndicator;

    readonly removePostButton;

    readonly postMenu;
    readonly threadFooter;

    // Burn-on-Read elements
    readonly burnOnReadBadge;
    readonly burnOnReadTimerChip;
    readonly concealedPlaceholder;

    // File attachments and their ABAC-redacted stand-in
    readonly fileAttachmentList;
    readonly redactedFilesPlaceholder;

    readonly postPreview;

    constructor(container: Locator) {
        this.container = container;

        this.body = container.getByTestId('post-body');

        this.profileIcon = container.getByTestId('profile-icon');
        this.emoticon = container.locator('.emoticon');
        this.messageText = container.locator('.post-message__text p');
        this.editedIndicator = container.getByRole('button', {name: 'Edited'});

        this.removePostButton = container.getByTestId('post-remove-button');

        this.postMenu = new PostMenu(container.getByTestId(/^post-menu($|-)/));
        this.threadFooter = new ThreadFooter(container.getByTestId('thread-footer'));

        // Burn-on-Read components
        this.burnOnReadBadge = new BurnOnReadBadge(container.getByTestId(/^burn-on-read-badge-/));
        this.burnOnReadTimerChip = new BurnOnReadTimerChip(container.getByTestId('burn-on-read-timer-chip'));
        this.concealedPlaceholder = new BurnOnReadConcealedPlaceholder(
            container.getByTestId(/^burn-on-read-concealed-/),
        );

        this.fileAttachmentList = container.getByTestId('fileAttachmentList');
        this.redactedFilesPlaceholder = container.getByTestId('redactedFilesPlaceholder');

        // The embedded permalink preview carries no test id, so the class name is the
        // only handle available.
        this.postPreview = container.locator('.post-preview');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    /**
     * Hover over the post. Can be used for post menu to appear.
     */
    async hover() {
        await this.container.hover();
    }

    async getId() {
        const id = await this.container.getAttribute('id');
        expect(id, 'No post ID found.').toBeTruthy();
        // Remove 'post_' prefix and any timestamp suffix (format: postId:timestamp for combined posts)
        const postIdWithPossibleTimestamp = (id || '').substring('post_'.length);
        // Return just the post ID (before any colon)
        return postIdWithPossibleTimestamp.split(':')[0];
    }

    async getProfileImage(username: string) {
        return this.profileIcon.getByAltText(`${username} profile image`);
    }

    /**
     * Locates a rendered link with the given accessible name inside the post body.
     * @param name
     */
    getLink(name: string): Locator {
        return this.container.getByRole('link', {name});
    }

    async openAThread() {
        await this.container.hover();
        await this.postMenu.toBeVisible();
        await this.postMenu.replyButton.waitFor();
        await this.postMenu.replyButton.click();
    }

    /**
     * Clicks the "Edited" indicator to open the post's edit history in the right sidebar.
     */
    async openEditHistory() {
        await this.editedIndicator.click();
    }

    async reply() {
        await this.container.hover();
        await this.postMenu.toBeVisible();
        await this.postMenu.reply();
    }

    /**
     * Hovers the post and opens the emoji reaction picker via the "add reaction" button.
     */
    async openReactionPicker() {
        await this.container.hover();
        await this.postMenu.toBeVisible();
        await this.postMenu.addReactionButton.click();
    }

    /**
     * Clicks on the deleted post's remove 'x' button.
     * Also verifies that the post is a deleted post.
     */
    async remove() {
        // Verify the post is a deleted post
        await expect(this.container).toContainText(/\(message deleted\)/);

        // Hover over the post and click on the remove post button
        await this.container.hover();
        await this.removePostButton.waitFor();
        await this.removePostButton.click();
    }

    /**
     * `toContainText` verifies if the post contains the specified text.
     * @param text Text to be verified in the post
     */
    async toContainText(text: string) {
        await expect(this.container).toContainText(text);
    }

    /**
     * `toNotContainText` verifies if the post does not contain the specified text.
     * @param text Text to be verified not in the post
     */
    async toNotContainText(text: string) {
        await expect(this.container).not.toContainText(text);
    }

    /**
     * @param scope Sub-region to assert within, e.g. an embedded permalink preview
     */
    async toHaveFilesVisible(scope: Locator = this.container) {
        await expectFilesVisible(scope);
    }

    /**
     * @param scope Sub-region to assert within, e.g. an embedded permalink preview
     */
    async toHaveFilesRedacted(scope: Locator = this.container) {
        await expectFilesRedacted(scope);
    }

    /**
     * Check if this is a burn-on-read post
     */
    async isBurnOnReadPost(): Promise<boolean> {
        // Check if BoR badge or timer chip is present
        const hasBadge = await this.burnOnReadBadge.container.isVisible();
        const hasTimer = await this.burnOnReadTimerChip.container.isVisible();
        return hasBadge || hasTimer;
    }

    /**
     * Check if the BoR post is concealed (not yet revealed)
     */
    async isConcealed(): Promise<boolean> {
        return this.concealedPlaceholder.container.isVisible();
    }

    /**
     * Check if the BoR post is revealed
     */
    async isRevealed(): Promise<boolean> {
        return !(await this.isConcealed());
    }
}
