// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

import PostMenu from './post_menu';
import ThreadFooter from './thread_footer';

export default class ChannelsPost {
    readonly container: Locator;

    readonly body;
    readonly profileIcon;

    readonly removePostButton;

    readonly postMenu;
    readonly threadFooter;

    constructor(container: Locator) {
        this.container = container;

        this.body = container.locator('.post__body');

        this.profileIcon = container.locator('.profile-icon');

        this.removePostButton = container.locator('.post__remove');

        this.postMenu = new PostMenu(container.locator('.post-menu'));
        this.threadFooter = new ThreadFooter(container.locator('.ThreadFooter'));
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
        return (id || '').substring('post_'.length);
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
}
