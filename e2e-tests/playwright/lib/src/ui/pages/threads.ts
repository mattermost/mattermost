// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import {expect} from '@playwright/test';

import {ChannelsPost} from '@/ui/components';

import {BasePage} from '../base_page';
import type {BaseComponent} from '../base_component';

export default class ThreadsPage extends BasePage {
    readonly components: Record<string, BaseComponent>;

    readonly threadsList;

    readonly noThreadSelected;

    constructor(page: Page) {
        super(page);

        this.threadsList = page.locator('#threads-list');

        this.noThreadSelected = page.getByTestId('threadPaneNoThread');

        this.components = {};
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
