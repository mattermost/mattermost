// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

export default class ChannelsPost {
    readonly container: Locator;
    readonly profileIcon: Locator;

    constructor(container: Locator) {
        this.container = container;

        this.profileIcon = container.locator('.profile-icon');
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
        return await this.profileIcon.getByAltText(`${username} profile image`);
    }
}

export {ChannelsPost};
