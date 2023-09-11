// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

import {components} from '@e2e-support/ui/components';

export default class ChannelsSidebarRight {
    readonly container: Locator;

    readonly postCreate;
    readonly closeButton;

    constructor(container: Locator) {
        this.container = container;

        this.postCreate = new components.ChannelsPostCreate(container.getByTestId('comment-create'), true);
        this.closeButton = container.locator('#rhsCloseButton');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    /**
     * Returns the RHS post by post id
     * @param postId Just the ID without the prefix
     */
    async getPostById(postId: string) {
        const post = this.container.locator(`[id="rhsPost_${postId}"]`);
        await post.waitFor();
        return new components.ChannelsPost(post);
    }

    /**
     * Return the last post in the RHS
     */
    async getLastPost() {
        const post = this.container.getByTestId('rhsPostView').last();
        await post.waitFor();
        return new components.ChannelsPost(post);
    }

    /**
     * Closes the RHS
     */
    async close() {
        await this.closeButton.waitFor();
        await this.closeButton.click();

        await expect(this.container).not.toBeVisible();
    }
}

export {ChannelsSidebarRight};
