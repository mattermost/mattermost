// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import en from '@/i18n';
import {BaseComponent} from '@/ui/base_component';

import BurnOnReadBadge from './burn_on_read/badge';
import BurnOnReadConcealedPlaceholder from './burn_on_read/concealed_placeholder';
import BurnOnReadTimerChip from './burn_on_read/timer_chip';
import PostMenu from './post_menu';
import ThreadFooter from './thread_footer';

export default class ChannelsPost extends BaseComponent {
    readonly body;
    readonly profileIcon;

    readonly removePostButton;

    readonly postMenu;
    readonly threadFooter;

    // Burn-on-Read elements
    readonly burnOnReadBadge;
    readonly burnOnReadTimerChip;
    readonly concealedPlaceholder;

    // Post body sub-elements
    readonly attachmentTitleLink: Locator;
    readonly attachmentAuthorName: Locator;
    readonly postPriority: Locator;
    readonly visibilityNote: Locator;
    readonly mentionHighlight: Locator;

    constructor(container: Locator) {
        super(container);

        this.body = container.getByTestId('postBody');

        this.profileIcon = container.getByTestId('profileIcon');

        this.removePostButton = container.getByTestId('postRemoveButton');

        this.postMenu = new PostMenu(container.getByTestId('postMenu'));
        this.threadFooter = new ThreadFooter(container.getByTestId('threadFooter'));

        // Burn-on-Read components
        this.burnOnReadBadge = new BurnOnReadBadge(container.getByTestId(/^burn-on-read-badge-/));
        this.burnOnReadTimerChip = new BurnOnReadTimerChip(container.getByTestId('burnOnReadTimerChip'));
        this.concealedPlaceholder = new BurnOnReadConcealedPlaceholder(
            container.getByTestId(/^burn-on-read-concealed-/),
        );

        // Post body sub-elements
        this.attachmentTitleLink = container.getByTestId('attachmentTitleLink');
        this.attachmentAuthorName = container.getByTestId('attachmentAuthorName');
        this.postPriority = container.getByTestId('post-priority-label');
        this.visibilityNote = container.getByTestId('postVisibilityNote');
        this.mentionHighlight = container.getByTestId('mentionHighlight');
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

    async openAThread() {
        await this.container.hover();
        await this.postMenu.toBeVisible();
        await this.postMenu.replyButton.waitFor();
        await this.postMenu.replyButton.click();
    }

    async reply() {
        await this.container.hover();
        await this.postMenu.toBeVisible();
        await this.postMenu.reply();
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

    get ephemeralLabel(): Locator {
        return this.container.getByText(en['post_info.message.visible']);
    }

    interactiveButton(name: string): Locator {
        return this.container.getByRole('button', {name});
    }

    get translationBadge(): Locator {
        return this.container.getByTestId('autotranslation-badge');
    }

    get showOriginalButton(): Locator {
        return this.container.getByRole('button', {name: en['channel_header.autotranslation.disable_confirm.confirm']});
    }

    getMentionLink(channelName?: string): Locator {
        if (channelName) {
            return this.body.locator(`a.mention-link[data-channel-mention="${channelName}"]`);
        }
        return this.body.locator('a.mention-link[data-channel-mention]');
    }
}
