// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

export default class ChannelsPost {
    readonly container: Locator;

    readonly body;
    readonly profileIcon;
    readonly replyPostActionButton;
    readonly replyButton;
    readonly removePostButton;

    constructor(container: Locator) {
        this.container = container;

        this.body = container.locator('.post__body');
        this.profileIcon = container.locator('.profile-icon');
        this.replyPostActionButton = container.getByRole('button', {name: 'reply'});
        this.replyButton = container.locator('.ReplyButton');
        this.removePostButton = container.locator('.post__remove');
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
        await this.replyPostActionButton.waitFor();
        await this.replyPostActionButton.click();
    }

    /**
     * Clicks on the reply button on the post with thread.
     */
    async openRHSWithReply() {
        await this.replyButton.waitFor();
        await this.replyButton.click();
    }

    /**
     * Clicks on the deleted post's remove 'x' button.
     * Also verifies that the post is a deleted post.
     */
    async clickOnRemovePost() {
        // Verify the post is a deleted post
        await expect(this.container).toContainText(/\(message deleted\)/)
    
        // Hover over the post and click on the remove post button
        await this.container.hover();
        await this.removePostButton.waitFor();
        await this.removePostButton.click();
    }

}

export {ChannelsPost};
