// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Page, expect} from '@playwright/test';

import {ChannelsPost} from '@/ui/components';
import { default as waitUntil } from 'async-wait-until';

export default class ThreadsPage {
    readonly page: Page;

    readonly threadsList;

    readonly noThreadSelected;

    constructor(page: Page) {
        this.page = page;

        this.threadsList = page.locator('#threads-list');

        this.noThreadSelected = page.locator('.no-results__title', {
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
        await waitUntil(async () => {
            const isVisible = await this.noThreadSelected.isVisible();
            return isVisible;
        }, {
            timeout: 5000,
            intervalBetweenAttempts: 100,
        });
        await expect(this.noThreadSelected).toBeVisible();
    }

    async getLastPost() {
        const lastPost = this.page.getByTestId('rhsPostView').last();
        await lastPost.waitFor();
        return new ChannelsPost(lastPost);
    }
}
