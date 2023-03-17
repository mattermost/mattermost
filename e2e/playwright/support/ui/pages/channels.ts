// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Page} from '@playwright/test';

import {ChannelsAppBar, ChannelsPost, ChannelsPostCreate, GlobalHeader} from '@e2e-support/ui/components';
import {isSmallScreen} from '@e2e-support/util';

export default class ChannelsPage {
    readonly channels = 'Channels';
    readonly page: Page;
    readonly postCreate: ChannelsPostCreate;
    readonly globalHeader: GlobalHeader;
    readonly appBar: ChannelsAppBar;

    constructor(page: Page) {
        this.page = page;
        this.postCreate = new ChannelsPostCreate(page.locator('#post-create'));
        this.globalHeader = new GlobalHeader(this.page.locator('#global-header'));
        this.appBar = new ChannelsAppBar(page.locator('.app-bar'));
    }

    async goto(teamName = '', channelName = '') {
        let channelsUrl = '/';
        if (teamName) {
            channelsUrl += `/${teamName}`;
            if (channelName) {
                channelsUrl += `/${channelName}`;
            }
        }

        await this.page.goto(channelsUrl);
    }

    async toBeVisible() {
        if (!isSmallScreen(this.page.viewportSize())) {
            await this.globalHeader.toBeVisible(this.channels);
        }
        await this.postCreate.toBeVisible();
    }

    async postMessage(message: string) {
        await this.postCreate.input.waitFor();
        await this.postCreate.postMessage(message);
    }

    async getFirstPost() {
        await this.page.getByTestId('postView').first().waitFor();
        const post = await this.page.getByTestId('postView').first();
        return new ChannelsPost(post);
    }

    async getLastPost() {
        await this.page.getByTestId('postView').last().waitFor();
        const post = await this.page.getByTestId('postView').last();
        return new ChannelsPost(post);
    }

    async getNthPost(index: number) {
        await this.page.getByTestId('postView').nth(index).waitFor();
        const post = await this.page.getByTestId('postView').nth(index);
        return new ChannelsPost(post);
    }

    async getPostById(id: string) {
        await this.page.locator(`[id="post_${id}"]`).waitFor();
        const post = await this.page.locator(`[id="post_${id}"]`);
        return new ChannelsPost(post);
    }
}

export {ChannelsPage};
