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

        this.postCreate = new components.ChannelsPostCreate(container.locator('#comment-create'), true);
        this.closeButton = container.locator('#rhsCloseButton');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    /**
     * Return the last post in the RHS
     */
    async getLastPost() {
        await this.container.getByTestId('rhsPostView').last().waitFor();
        const post = this.container.getByTestId('rhsPostView').last();
        return new components.ChannelsPost(post);
    }

    /**
     * Returns the RHS post by post id
     * @param postId Just the ID without the prefix
     */
    async getRHSPostById(postId: string) {
        const rhsPostId = `rhsPost_${postId}`;
        const postLocator = this.container.locator(`#${rhsPostId}`);
        return new components.ChannelsPost(postLocator);
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
