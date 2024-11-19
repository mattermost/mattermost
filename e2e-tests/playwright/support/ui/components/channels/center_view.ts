// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

import {components} from '@e2e-support/ui/components';
import {waitUntil} from '@e2e-support/test_action';
import {duration} from '@e2e-support/util';

export default class ChannelsCenterView {
    readonly container: Locator;

    readonly header;
    readonly postCreate;
    readonly scheduledDraftOptions;
    readonly scheduledDraftChannelInfo;
    readonly scheduledDraftChannelIcon;
    readonly scheduledDraftChannelInfoMessage;
    readonly scheduledDraftChannelInfoMessageText;
    readonly scheduledDraftSeeAllLink;

    constructor(container: Locator) {
        this.container = container;

        this.header = new components.ChannelsHeader(this.container.locator('.channel-header'));
        this.postCreate = new components.ChannelsPostCreate(container.getByTestId('post-create'));
        this.scheduledDraftOptions = new components.ChannelsPostCreate(
            container.locator('#dropdown_send_post_options'),
        );
        this.scheduledDraftChannelInfo = container.locator('div.postBoxIndicator');
        this.scheduledDraftChannelIcon = container.locator('#create_post i.icon-draft-indicator');
        this.scheduledDraftChannelInfoMessage = container.locator('div.ScheduledPostIndicator span');
        this.scheduledDraftChannelInfoMessageText = container.locator('span:has-text("Message scheduled for")');
        this.scheduledDraftSeeAllLink = container.locator('a:has-text("See all scheduled messages")');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await this.postCreate.toBeVisible();
    }

    /**
     * Click on "See all scheduled messages"
     */
    async clickOnSeeAllscheduledDrafts() {
        await this.scheduledDraftSeeAllLink.isVisible();
        await this.scheduledDraftSeeAllLink.click();
    }

    /**
     * Return the first post in the Center
     */
    async getFirstPost() {
        const firstPost = this.container.getByTestId('postView').first();
        await firstPost.waitFor();
        return new components.ChannelsPost(firstPost);
    }

    /**
     * Return the last post in the Center
     */
    async getLastPost() {
        const lastPost = this.container.getByTestId('postView').last();
        await lastPost.waitFor();
        return new components.ChannelsPost(lastPost);
    }

    /**
     * Return the Nth post in the Center from the top
     * @param index
     * @returns
     */
    async getNthPost(index: number) {
        const nthPost = this.container.getByTestId('postView').nth(index);
        await nthPost.waitFor();
        return new components.ChannelsPost(nthPost);
    }

    /**
     * Returns the Center post by post's id
     * @param postId Just the ID without the prefix
     */
    async getPostById(id: string) {
        const postById = this.container.locator(`[id="post_${id}"]`);
        await postById.waitFor();
        return new components.ChannelsPost(postById);
    }

    async waitUntilLastPostContains(text: string, timeout = duration.ten_sec) {
        await waitUntil(
            async () => {
                const post = await this.getLastPost();
                const content = await post.container.textContent();
                return content?.includes(text);
            },
            {timeout},
        );
    }

    async waitUntilPostWithIdContains(id: string, text: string, timeout = duration.ten_sec) {
        await waitUntil(
            async () => {
                const post = await this.getPostById(id);
                const content = await post.container.textContent();

                return content?.includes(text);
            },
            {timeout},
        );
    }

    async verifyscheduledDraftChannelInfo() {
        await this.scheduledDraftChannelInfo.isVisible();
        await this.scheduledDraftChannelIcon.isVisible();
        const messageLocator = this.scheduledDraftChannelInfoMessage.first();
        await expect(messageLocator).toContainText('Message scheduled for');
    }
}

export {ChannelsCenterView};
