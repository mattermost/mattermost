// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Page} from '@playwright/test';

import {components} from '@e2e-support/ui/components';

export default class ChannelsPage {
    readonly channels = 'Channels';

    readonly page: Page;

    readonly globalHeader;
    readonly searchPopover;
    readonly centerView;
    readonly scheduledDraftDropdown;
    readonly scheduledDraftModal;
    readonly sidebarLeft;
    readonly sidebarRight;
    readonly appBar;
    readonly userProfilePopover;

    readonly findChannelsModal;
    readonly deletePostModal;
    readonly settingsModal;

    readonly postContainer;
    readonly postDotMenu;
    readonly postReminderMenu;

    readonly emojiGifPickerPopup;

    constructor(page: Page) {
        this.page = page;

        // The main areas of the app
        this.globalHeader = new components.GlobalHeader(page.locator('#global-header'));
        this.searchPopover = new components.SearchPopover(page.locator('#searchPopover'));
        this.centerView = new components.ChannelsCenterView(page.getByTestId('channel_view'));
        this.sidebarLeft = new components.ChannelsSidebarLeft(page.locator('#SidebarContainer'));
        this.sidebarRight = new components.ChannelsSidebarRight(page.locator('#sidebar-right'));
        this.appBar = new components.ChannelsAppBar(page.locator('.app-bar'));

        // Modals
        this.findChannelsModal = new components.FindChannelsModal(page.getByRole('dialog', {name: 'Find Channels'}));
        this.deletePostModal = new components.DeletePostModal(page.locator('#deletePostModal'));
        this.settingsModal = new components.SettingsModal(page.getByRole('dialog', {name: 'Settings'}));

        // Menus
        this.postDotMenu = new components.PostDotMenu(page.getByRole('menu', {name: 'Post extra options'}));
        this.postReminderMenu = new components.PostReminderMenu(page.getByRole('menu', {name: 'Set a reminder for:'}));

        // Popovers
        this.emojiGifPickerPopup = new components.EmojiGifPicker(page.locator('#emojiGifPicker'));
        this.scheduledDraftDropdown = new components.ScheduledDraftMenu(page.locator('#dropdown_send_post_options'));
        this.scheduledDraftModal = new components.ScheduledDraftModal(page.locator('div.modal-content'));
        this.userProfilePopover = new components.UserProfilePopover(page.locator('.user-profile-popover'));

        // Posts
        this.postContainer = page.locator('div.post-message__text');
    }

    async toBeVisible() {
        await this.centerView.toBeVisible();
    }

    async getLastPost() {
        return this.postContainer.last();
    }

    async goto(teamName = '', channelName = '') {
        let channelsUrl = '/';
        if (teamName) {
            channelsUrl += `${teamName}`;
            if (channelName) {
                const prefix = channelName.startsWith('@') ? '/messages' : '/channels';
                channelsUrl += `${prefix}/${channelName}`;
            }
        }
        await this.page.goto(channelsUrl);
    }

    /**
     * `postMessage` posts a message in the current channel
     * @param message Message to post
     */
    async postMessage(message: string) {
        await this.centerView.postCreate.postMessage(message);
    }
}

export {ChannelsPage};
