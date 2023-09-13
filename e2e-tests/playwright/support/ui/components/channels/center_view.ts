// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

import {components} from '@e2e-support/ui/components';
import {waitUntil} from '@e2e-support/test_action';
import {duration} from '@e2e-support/util';

export default class ChannelsCenterView {
    readonly container: Locator;

    readonly header;
    readonly headerMobile;
    readonly postCreate;

    constructor(container: Locator) {
        this.container = container;

        this.header = new components.ChannelsHeader(this.container.locator('.channel-header'));
        this.headerMobile = new components.ChannelsHeaderMobile(this.container.locator('.navbar'));
        this.postCreate = new components.ChannelsPostCreate(container.getByTestId('post-create'));
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await this.postCreate.toBeVisible();
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
            {timeout}
        );
    }

    async waitUntilPostWithIdContains(id: string, text: string, timeout = duration.ten_sec) {
        await waitUntil(
            async () => {
                const post = await this.getPostById(id);
                const content = await post.container.textContent();

                return content?.includes(text);
            },
            {timeout}
        );
    }
}

export {ChannelsCenterView};
