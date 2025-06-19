// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect, Page} from '@playwright/test';

import ChannelsHeader from './header';
import ChannelsPostCreate from './post_create';
import ChannelsPostEdit from './post_edit';
import ChannelsPost from './post';
import ScheduledPostIndicator from './scheduled_post_indicator';

import {duration, hexToRgb} from '@/util';
import {waitUntil} from '@/test_action';

export default class ChannelsCenterView {
    readonly container: Locator;
    readonly page: Page;

    readonly header;
    readonly postCreate;
    readonly scheduledDraftOptions;
    readonly scheduledPostIndicator;
    readonly postEdit;
    readonly editedPostIcon;
    readonly channelBanner;

    constructor(container: Locator, page: Page) {
        this.container = container;
        this.page = page;

        this.header = new ChannelsHeader(this.container.locator('.channel-header'));
        this.postCreate = new ChannelsPostCreate(container.getByTestId('post-create'));
        this.scheduledDraftOptions = new ChannelsPostCreate(container.locator('#dropdown_send_post_options'));
        this.postEdit = new ChannelsPostEdit(container.locator('.post-edit__container'));
        this.scheduledPostIndicator = new ScheduledPostIndicator(container.getByTestId('scheduledPostIndicator'));
        this.editedPostIcon = (postID: string) => container.locator(`#postEdited_${postID}`);
        this.channelBanner = container.getByTestId('channel_banner_container');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await this.postCreate.toBeVisible();
    }

    async postMessage(message: string, files?: string[]) {
        await this.postCreate.postMessage(message, files);
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

    async clickOnLastEditedPost(postID: string | null) {
        if (postID) {
            await this.editedPostIcon(postID).click();
        }
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

    async assertChannelBannerHasBoldText(text: string) {
        const boldText = await this.channelBanner.locator('strong');
        expect(boldText).toBeVisible();

        const actualText = await boldText.textContent();
        expect(actualText).toBe(text);
    }

    async assertChannelBannerHasItalicText(text: string) {
        const italicText = await this.channelBanner.locator('em');
        expect(italicText).toBeVisible();

        const actualText = await italicText.textContent();
        expect(actualText).toBe(text);
    }

    async assertChannelBannerHasStrikethroughText(text: string) {
        const strikethroughText = await this.channelBanner.locator('del');
        expect(strikethroughText).toBeVisible();

        const actualText = await strikethroughText.textContent();
        expect(actualText).toBe(text);
    }
}
