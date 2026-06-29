// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import en from '@/i18n';
import {hexToRgb} from '@/util';
import {BaseComponent} from '@/ui/base_component';

import ChannelsPostCreate from '../center_view/post_create';
import ChannelsPostEdit from '../center_view/post/post_edit';
import ChannelsPost from '../center_view/post/post';
import ScheduledPostIndicator from '../scheduled_post_indicator';

export default class ChannelsSidebarRight extends BaseComponent {
    readonly closeButton;
    readonly postCreate;
    readonly rhsPostBody;
    readonly scheduledPostIndicator;
    readonly scheduledDraftChannelInfoMessage;
    readonly scheduledDraftSeeAllLink;
    readonly scheduledDraftChannelInfoMessageText;
    readonly editTextbox;
    readonly postEdit;
    readonly currentVersionEditedPosttext;
    readonly restorePreviousPostVersionIcon;
    readonly channelBanner;

    constructor(container: Locator) {
        super(container);

        this.scheduledPostIndicator = new ScheduledPostIndicator(container.getByTestId('scheduledPostIndicator'));
        this.scheduledDraftChannelInfoMessage = container.getByTestId('scheduledPostInfoText');
        this.scheduledDraftSeeAllLink = container.getByTestId('scheduledPostSeeAll');
        this.scheduledDraftChannelInfoMessageText = container.getByTestId('scheduledPostInfoText');
        this.rhsPostBody = container.getByTestId('rhsPostMessageText');
        this.postCreate = new ChannelsPostCreate(container.getByTestId('comment-create'), true);
        this.closeButton = container.locator('#rhsCloseButton');

        this.editTextbox = container.locator('#edit_textbox');
        this.postEdit = new ChannelsPostEdit(container.getByTestId('postEditContainer'));
        this.currentVersionEditedPosttext = (postID: any) => container.locator(`#rhsPostMessageText_${postID} p`);
        this.restorePreviousPostVersionIcon = container.getByLabel(en['post_info.edit.aria_label']);
        this.channelBanner = container.getByTestId('channel_banner_container');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async postMessage(message: string) {
        await this.postCreate.postMessage(message);
    }

    /**
     * Returns the RHS post by post id
     * @param postId Just the ID without the prefix
     */
    async getPostById(postId: string) {
        const post = this.container.locator(`[id="rhsPost_${postId}"]`);
        await post.waitFor();
        return new ChannelsPost(post);
    }

    /**
     * Return the last post in the RHS
     */
    async getLastPost() {
        const post = this.container.getByTestId('rhsPostView').last();
        await post.waitFor();
        return new ChannelsPost(post);
    }

    async getFirstPost() {
        const post = this.container.getByTestId('rhsPostView').first();
        await post.waitFor();
        return new ChannelsPost(post);
    }

    /**
     * Closes the RHS
     */
    async close() {
        await this.closeButton.waitFor();
        await this.closeButton.click();

        await expect(this.container).not.toBeVisible();
    }

    async toContainText(text: string, timeout?: number) {
        await expect(this.container).toContainText(text, {timeout});
    }

    async verifyCurrentVersionPostMessage(postID: string | null, postMessageContent: string) {
        expect(await this.currentVersionEditedPosttext(postID).textContent()).toBe(postMessageContent);
    }

    async restorePreviousPostVersion() {
        await this.restorePreviousPostVersionIcon.isVisible();
        await this.restorePreviousPostVersionIcon.click();
    }

    async assertChannelBanner(text: string, backgroundColor: string) {
        await expect(this.channelBanner).toBeVisible();

        const actualText = await this.channelBanner.textContent();
        expect(actualText).toBe(text);

        const actualBackgroundColor = await this.channelBanner.evaluate((el) => {
            return window.getComputedStyle(el).getPropertyValue('background-color');
        });

        expect(actualBackgroundColor).toBe(hexToRgb(backgroundColor));
    }

    async assertChannelBannerNotVisible() {
        await expect(this.channelBanner).not.toBeVisible();
    }
}
