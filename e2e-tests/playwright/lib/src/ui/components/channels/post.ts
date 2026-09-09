// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import BurnOnReadBadge from './burn_on_read_badge';
import BurnOnReadConcealedPlaceholder from './burn_on_read_concealed_placeholder';
import BurnOnReadTimerChip from './burn_on_read_timer_chip';
import PostMenu from './post_menu';
import ThreadFooter from './thread_footer';
import LinkPreview from './link_preview';

import {duration, wait} from '@/util';

// "<26-char id>:<timestamp>" — a pending_post_id before the server acks, but also the permanent
// DOM id of a combined post (see ChannelsCenterView.postById). Indistinguishable by shape.
const SUFFIXED_POST_ID_RE = /^([a-z0-9]{26}):\d+$/;

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
    readonly avatarImage;
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
        this.avatarImage = this.profileIcon.locator('img.Avatar, img').first();
        this.fileAttachmentList = container.getByTestId('fileAttachmentList');
        this.emoticon = container.locator('.emoticon');
        this.messageText = container.locator('.post-message__text p');
        this.editedIndicator = container.getByText('Edited', {exact: true});

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

    /**
     * Returns the post's permanent ID.
     *
     * A just-sent post renders optimistically under its pending_post_id, which is the author's ID,
     * not the post's — so retry briefly to give the server ack time to land. A combined post is
     * suffixed the same way but is already permanent, so fall back to the prefix rather than
     * failing: waiting cannot improve it.
     */
    async getId(attempts = 3) {
        let id: string | null = null;
        let postId = '';

        for (let attempt = 0; attempt < attempts; attempt++) {
            if (attempt > 0) {
                await wait(duration.one_sec);
            }

            id = await this.container.getAttribute('id');
            postId = (id ?? '').substring('post_'.length);

            if (postId && !SUFFIXED_POST_ID_RE.test(postId)) {
                return postId;
            }
        }

        const suffixed = SUFFIXED_POST_ID_RE.exec(postId);
        if (suffixed) {
            return suffixed[1];
        }

        throw new Error(`No post ID found after ${attempts} attempts, last saw id="${id}".`);
    }

    async toHaveId(postId: string) {
        await expect.poll(() => this.getId()).toBe(postId);
    }

    async toBeEdited() {
        await expect(this.editedIndicator).toBeVisible();
    }

    async isSystemMessage() {
        return this.container.evaluate((element) => element.classList.contains('post--system'));
    }

    async toBeSystemMessage() {
        await expect(this.container).toHaveClass(/post--system/);
        await expect(this.container).not.toHaveClass(/same--root|other--root|current--user|post--comment|post--root/);
        await expect(this.container.locator('.status-wrapper .status svg')).not.toBeVisible();
    }

    async toBeSystemMessageContaining(text: string | RegExp) {
        await this.toBeSystemMessage();
        await expect(this.container).toContainText(text);
    }

    async getProfileImage(username: string) {
        return this.profileIcon.getByAltText(`${username} profile image`);
    }

    /**
     * True if the post header's avatar <img> actually loaded a real image (not broken/blank) —
     * confirms a profile photo renders correctly, not just that the element exists in the DOM.
     */
    async hasLoadedAvatar(): Promise<boolean> {
        await expect(this.avatarImage).toBeVisible();
        await expect
            .poll(async () =>
                this.avatarImage.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
            )
            .toBe(true);
        return true;
    }

    /**
     * Locates a SENT post's rendered file-attachment thumbnail/link by filename — distinct from
     * ChannelsPostCreate.waitUntilFilePreviewContains(), which only confirms the compose-time
     * preview before the post is sent.
     */
    getFileAttachmentThumbnail(fileName: string): Locator {
        const thumbnailName = `file thumbnail ${fileName}`;
        // Newer builds wrap the thumbnail in a link; older builds render a plain img/figure.
        // .first(): a link-wrapped thumbnail matches both branches, and a two-element locator
        // fails strict-mode assertions.
        return this.container
            .getByRole('link', {name: thumbnailName})
            .or(this.container.getByRole('img', {name: thumbnailName}))
            .first();
    }

    /**
     * Downloads a sent post's file attachment via its rendered download link, returning the local
     * path the browser saved it to — confirms the file backend actually serves real content, not
     * just that a download-looking link is present in the DOM.
     */
    async downloadAttachment(fileName: string): Promise<string> {
        await expect(this.getFileAttachmentThumbnail(fileName)).toBeVisible();

        const attachment = this.fileAttachmentList
            .locator('[data-testid="media-gallery-tile"], .post-image__column')
            .filter({hasText: fileName});
        const downloadLink = attachment.getByRole('link', {name: 'download'});

        const page = this.container.page();
        const [download] = await Promise.all([page.waitForEvent('download'), downloadLink.click()]);

        const downloadPath = await download.path();
        if (!downloadPath) {
            throw new Error(`Download of "${fileName}" failed — no local path returned.`);
        }
        return downloadPath;
    }

    /**
     * Locates a rendered link with the given accessible name inside the post body.
     * @param name
     */
    getLink(name: string): Locator {
        return this.container.getByRole('link', {name});
    }

    getInlineImage(altText: string) {
        return this.body.getByAltText(altText);
    }

    getInlineImageLink(altText: string) {
        return this.body.getByRole('link').filter({has: this.container.page().getByAltText(altText)});
    }

    async openInlineImagePreview(altText: string) {
        await this.getInlineImage(altText).click();
    }

    async toHaveStrikethroughText(text: string) {
        const strikethrough = this.body.getByText(text, {exact: true});
        await expect(strikethrough).toBeVisible();
        await expect(strikethrough).toHaveJSProperty('tagName', 'DEL');
    }

    async toBeDeleted(originalMessage?: string) {
        await expect(this.container).toContainText('(message deleted)');
        if (originalMessage) {
            await expect(this.container).not.toContainText(originalMessage);
        }
    }

    getLinkPreview() {
        return new LinkPreview(this.body.getByTestId('link-preview'));
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
