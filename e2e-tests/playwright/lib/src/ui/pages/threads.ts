// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import {expect} from '@playwright/test';

import {ChannelsPost} from '@/ui/components';

export default class ThreadsPage {
    readonly page: Page;

    readonly threadsList;

    readonly noThreadSelected;

    constructor(page: Page) {
        this.page = page;

        this.threadsList = page.locator('#threads-list');

        this.noThreadSelected = page.getByTestId('no-results-title').filter({
            hasText: /Looks like you’re all caught up|Catch up on your threads/,
        });
    }

    async goto(teamName: string) {
        await this.page.goto(`/${teamName}/threads`);
    }

    async toBeVisible() {
        await expect(this.threadsList).toBeVisible();
    }

    async toHaveThreadSelected() {
        await expect(this.noThreadSelected).not.toBeAttached();
    }

    async toNotHaveThreadSelected() {
        await this.noThreadSelected.waitFor({state: 'visible'});
        await expect(this.noThreadSelected).toBeVisible();
    }

    async getLastPost() {
        const lastPost = this.page.getByTestId('rhsPostView').last();
        await lastPost.waitFor();
        return new ChannelsPost(lastPost);
    }
}
