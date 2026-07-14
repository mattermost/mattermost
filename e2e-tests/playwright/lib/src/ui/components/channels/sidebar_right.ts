// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import ChannelsPostCreate from './post_create';
import ChannelsPostEdit from './post_edit';
import ChannelsPost from './post';
import ScheduledPostIndicator from './scheduled_post_indicator';

import {hexToRgb} from '@/util';

export default class ChannelsSidebarRight {
    readonly container: Locator;

    readonly closeButton;
    readonly expandButton;
    readonly collapseButton;
    readonly manageMembersButton;
    readonly addMembersButton;
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
    readonly notificationSeparator;

    constructor(container: Locator) {
        this.container = container;

        this.scheduledPostIndicator = new ScheduledPostIndicator(container.getByTestId('scheduledPostIndicator'));
        this.scheduledDraftChannelInfoMessage = container.getByTestId('scheduledPostIndicator').locator('span');
        this.scheduledDraftSeeAllLink = container
            .getByTestId('scheduledPostIndicator')
            .getByRole('link', {name: 'See all.'});
        this.scheduledDraftChannelInfoMessageText = container
            .getByTestId('scheduledPostIndicator')
            .getByText(/Message scheduled for/);
        this.rhsPostBody = container.getByTestId('post-message-text');
        this.postCreate = new ChannelsPostCreate(container.getByTestId('comment-create'), true);
        this.closeButton = container.getByRole('button', {name: 'Close'});
        this.expandButton = container.getByRole('button', {name: 'Expand Sidebar Icon'});
        this.collapseButton = container.getByRole('button', {name: 'Collapse Sidebar Icon'});

        // Member-management controls shown in the channel members list (RHS).
        this.manageMembersButton = container.getByRole('button', {name: 'Manage'});
        this.addMembersButton = container.getByRole('button', {name: 'Add'});

        this.editTextbox = container.locator('#edit_textbox');
        this.postEdit = new ChannelsPostEdit(container.getByTestId('post-edit-container'));
        this.currentVersionEditedPosttext = (postID: any) => container.locator(`#rhsPostMessageText_${postID} p`);
        this.restorePreviousPostVersionIcon = container.locator(
            'button[aria-label="Select to restore an old message."]',
        );
        this.channelBanner = container.getByTestId('channel_banner_container');
        this.notificationSeparator = container.locator('.NotificationSeparator');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async expand() {
        await this.expandButton.click();
    }

    async collapse() {
        await this.collapseButton.click();
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
