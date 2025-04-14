// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

import ChannelsHeader from './header';
import ChannelsPostCreate from './post_create';
import ChannelsPostEdit from './post_edit';
import ChannelsPost from './post';

import {duration} from '@/util';
import {waitUntil} from '@/test_action';

export default class ChannelsCenterView {
    readonly container: Locator;

    readonly header;
    readonly postCreate;
    readonly scheduledDraftOptions;
    readonly postBoxIndicator;
    readonly scheduledDraftChannelIcon;
    readonly scheduledDraftChannelInfoMessage;
    readonly scheduledDraftChannelInfoMessageLocator;
    readonly scheduledDraftDMChannelLocator;
    readonly scheduledDraftChannelInfoMessageText;
    readonly scheduledDraftDMChannelLocatorString;
    readonly scheduledDraftSeeAllLink;
    readonly postEdit;
    readonly editedPostIcon;

    constructor(container: Locator) {
        this.container = container;
        this.scheduledDraftChannelInfoMessageLocator = 'span:has-text("Message scheduled for")';
        this.scheduledDraftDMChannelLocatorString = 'div.ScheduledPostIndicator span a';
        this.header = new ChannelsHeader(this.container.locator('.channel-header'));
        this.postCreate = new ChannelsPostCreate(container.getByTestId('post-create'));
        this.scheduledDraftOptions = new ChannelsPostCreate(container.locator('#dropdown_send_post_options'));
        this.postEdit = new ChannelsPostEdit(container.locator('.post-edit__container'));
        this.postBoxIndicator = container.locator('div.postBoxIndicator');
        this.scheduledDraftChannelIcon = container.locator('#create_post i.icon-draft-indicator');
        this.scheduledDraftChannelInfoMessage = container.locator('div.ScheduledPostIndicator span');
        this.scheduledDraftChannelInfoMessageText = container.locator(this.scheduledDraftChannelInfoMessageLocator);
        this.scheduledDraftDMChannelLocator = container.locator(this.scheduledDraftDMChannelLocatorString);
        this.scheduledDraftSeeAllLink = container.locator('a:has-text("See all")');
        this.editedPostIcon = (postID: string) => container.locator(`#postEdited_${postID}`);
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
        return new ChannelsPost(firstPost);
    }

    /**
     * Return the last post in the Center
     */
    async getLastPost() {
        const lastPost = this.container.getByTestId('postView').last();
        await lastPost.waitFor();
        return new ChannelsPost(lastPost);
    }

    /**
     * Return the ID of the last post in the Center
     */
    async getLastPostID() {
        return this.container
            .getByTestId('postView')
            .last()
            .getAttribute('id')
            .then((id) => (id ? id.split('_')[1] : null));
    }

    /**
     * Return the Nth post in the Center from the top
     * @param index
     * @returns
     */
    async getNthPost(index: number) {
        const nthPost = this.container.getByTestId('postView').nth(index);
        await nthPost.waitFor();
        return new ChannelsPost(nthPost);
    }

    /**
     * Returns the Center post by post's id
     * @param postId Just the ID without the prefix
     */
    async getPostById(id: string) {
        const postById = this.container.locator(`[id="post_${id}"]`);
        await postById.waitFor();
        return new ChannelsPost(postById);
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

    async goToScheduledDraftsFromDMChannel() {
        if (await this.scheduledDraftDMChannelLocator.isVisible()) {
            await this.scheduledDraftDMChannelLocator.click();
            return;
        }
        await this.scheduledDraftSeeAllLink.isVisible();
        await this.scheduledDraftSeeAllLink.click();
    }

    async verifyscheduledDraftChannelInfo() {
        await this.postBoxIndicator.isVisible();
        await this.scheduledDraftChannelIcon.isVisible();
        const messageLocator = this.scheduledDraftChannelInfoMessage.first();
        await expect(messageLocator).toContainText('Message scheduled for');
    }

    async clickOnLastEditedPost(postID: string | null) {
        if (postID) {
            await this.editedPostIcon(postID).click();
        }
    }
}
