// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

import ChannelsPostCreate from './post_create';
import ChannelsPostEdit from './post_edit';
import ChannelsPost from './post';
import ScheduledPostIndicator from './scheduled_post_indicator';

export default class ChannelsSidebarRight {
    readonly container: Locator;

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

    constructor(container: Locator) {
        this.container = container;

        this.scheduledPostIndicator = new ScheduledPostIndicator(container.getByTestId('scheduledPostIndicator'));
        this.scheduledDraftChannelInfoMessage = container.locator('div.ScheduledPostIndicator span');
        this.scheduledDraftSeeAllLink = container.locator('a:has-text("See all")');
        this.scheduledDraftChannelInfoMessageText = container.locator('span:has-text("Message scheduled for")');
        this.rhsPostBody = container.locator('.post-message__text');
        this.postCreate = new ChannelsPostCreate(container.getByTestId('comment-create'), true);
        this.closeButton = container.locator('.sidebar--right__close');

        this.editTextbox = container.locator('#edit_textbox');
        this.postEdit = new ChannelsPostEdit(container.locator('.post-edit__container'));
        this.currentVersionEditedPosttext = (postID: any) => container.locator(`#rhsPostMessageText_${postID} p`);
        this.restorePreviousPostVersionIcon = container.locator(
            'button[aria-label="Select to restore an old message."]',
        );
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

    async toContainText(text: string) {
        await expect(this.container).toContainText(text);
    }

    async verifyCurrentVersionPostMessage(postID: string | null, postMessageContent: string) {
        expect(await this.currentVersionEditedPosttext(postID).textContent()).toBe(postMessageContent);
    }

    async restorePreviousPostVersion() {
        await this.restorePreviousPostVersionIcon.isVisible();
        await this.restorePreviousPostVersionIcon.click();
    }
}
