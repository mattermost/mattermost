// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import {expect} from '@playwright/test';

import {ChannelAttributeLabels, ChannelsPost} from '@/ui/components';

export default class ThreadsPage {
    readonly page: Page;

    readonly threadsList;

    readonly noThreadSelected;

    readonly threadPane;

    readonly followButton;

    readonly attributes: ChannelAttributeLabels;

    constructor(page: Page) {
        this.page = page;

        this.threadsList = page.locator('#threads-list');

        this.noThreadSelected = page.getByTestId('no-results-title').filter({
            hasText: /Looks like you’re all caught up|Catch up on your threads/,
        });

        this.threadPane = page.locator('#thread-pane-container');
        this.followButton = this.threadPane.locator('.FollowButton');

        // The thread header merges the info and header chip slots into one row.
        this.attributes = new ChannelAttributeLabels(
            this.threadPane.getByTestId('channelAttributeLabels-info-header'),
            'info-header',
        );
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

    async selectThread(rootMessage: string) {
        await this.threadsList.getByText(rootMessage).click();
        await this.toHaveThreadSelected();
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
