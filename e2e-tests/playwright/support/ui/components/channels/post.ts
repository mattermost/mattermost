// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

export default class ChannelsPost {
    readonly container: Locator;

    readonly body;
    readonly profileIcon;

    readonly replyThreadButton;
    readonly removePostButton;

    readonly postActionReplyButton;
    readonly postActionMoreButton;

    constructor(container: Locator) {
        this.container = container;

        this.body = container.locator('.post__body');

        this.profileIcon = container.locator('.profile-icon');

        this.replyThreadButton = container.locator('.ReplyButton');
        this.removePostButton = container.locator('.post__remove');

        this.postActionReplyButton = container.getByRole('button', {name: 'reply'});
        this.postActionMoreButton = container.getByRole('button', {name: 'more'});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async getId() {
        const id = await this.container.getAttribute('id');
        expect(id, 'No post ID found.').toBeTruthy();
        return (id || '').substring('post_'.length);
    }

    async getProfileImage(username: string) {
        return this.profileIcon.getByAltText(`${username} profile image`);
    }

    /**
     * Hover over the post and click on the reply button from post options.
     */
    async openRHSWithPostOptions() {
        await this.container.hover();
        await this.postActionReplyButton.waitFor();
        await this.postActionReplyButton.click();
    }

    /**
     * Clicks on the reply button on the post with thread.
     */
    async openRHSWithReply() {
        await this.replyThreadButton.waitFor();
        await this.replyThreadButton.click();
    }

    /**
     * Clicks on the deleted post's remove 'x' button.
     * Also verifies that the post is a deleted post.
     */
    async clickOnRemovePost() {
        // Verify the post is a deleted post
        await expect(this.container).toContainText(/\(message deleted\)/);

        // Hover over the post and click on the remove post button
        await this.container.hover();
        await this.removePostButton.waitFor();
        await this.removePostButton.click();
    }

    /**
     * Hovers over the post and clicks on the post's more button to open the post options menu
     */
    async openPostActionsMenu() {
        await this.container.hover();
        await this.postActionMoreButton.waitFor();
        await this.postActionMoreButton.click();
    }
}

export {ChannelsPost};
