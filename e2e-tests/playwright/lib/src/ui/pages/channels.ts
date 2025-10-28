// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Page} from '@playwright/test';
import {waitUntil} from 'async-wait-until';

import {ChannelsPost, ChannelSettingsModal, SettingsModal, components, InvitePeopleModal} from '@/ui/components';
import {duration} from '@/util';
export default class ChannelsPage {
    readonly channels = 'Channels';

    readonly page: Page;

    readonly globalHeader;
    readonly userAccountMenuButton;
    readonly searchBox;
    readonly centerView;
    readonly sidebarLeft;
    readonly sidebarRight;
    readonly appBar;
    readonly userProfilePopover;
    readonly messagePriority;

    readonly channelSettingsModal;
    readonly deletePostModal;
    readonly findChannelsModal;
    public invitePeopleModal: InvitePeopleModal | undefined;
    readonly profileModal;
    readonly settingsModal;
    readonly teamSettingsModal;
    readonly scheduledDraftModal;
    readonly scheduleMessageModal;

    readonly postContainer;
    readonly postDotMenu;
    readonly postReminderMenu;
    readonly userAccountMenu;
    readonly teamMenu;

    readonly emojiGifPickerPopup;
    readonly scheduleMessageMenu;

    constructor(page: Page) {
        this.page = page;

        // The main areas of the app
        this.globalHeader = new components.GlobalHeader(this, page.locator('#global-header'));
        this.searchBox = new components.SearchBox(page.locator('#searchBox'));
        this.centerView = new components.ChannelsCenterView(page.getByTestId('channel_view'), page);
        this.sidebarLeft = new components.ChannelsSidebarLeft(page.locator('#SidebarContainer'));
        this.sidebarRight = new components.ChannelsSidebarRight(page.locator('#sidebar-right'));
        this.appBar = new components.ChannelsAppBar(page.locator('.app-bar'));
        this.messagePriority = new components.MessagePriority(page.locator('body'));
        this.userAccountMenuButton = page.getByRole('button', {name: "User's account menu"});

        // Modals
        this.channelSettingsModal = new ChannelSettingsModal(page.getByRole('dialog', {name: 'Channel Settings'}));
        this.deletePostModal = new components.DeletePostModal(page.locator('#deletePostModal'));
        this.findChannelsModal = new components.FindChannelsModal(page.getByRole('dialog', {name: 'Find Channels'}));
        this.profileModal = new components.ProfileModal(page.getByRole('dialog', {name: 'Profile'}));
        this.settingsModal = new components.SettingsModal(page.getByRole('dialog', {name: 'Settings'}));
        this.teamSettingsModal = new components.TeamSettingsModal(page.getByRole('dialog', {name: 'Team Settings'}));

        // Menus
        this.postDotMenu = new components.PostDotMenu(page.getByRole('menu', {name: 'Post extra options'}));
        this.postReminderMenu = new components.PostReminderMenu(page.getByRole('menu', {name: 'Set a reminder for:'}));
        this.userAccountMenu = new components.UserAccountMenu(page.locator('#userAccountMenu'));
        this.scheduleMessageMenu = new components.ScheduleMessageMenu(page.locator('#dropdown_send_post_options'));
        this.teamMenu = new components.TeamMenu(page.locator('#sidebarTeamMenu'));

        // Popovers
        this.emojiGifPickerPopup = new components.EmojiGifPicker(page.locator('#emojiGifPicker'));
        this.scheduledDraftModal = new components.ScheduledDraftModal(page.locator('div.modal-content'));
        this.scheduleMessageModal = new components.ScheduleMessageModal(
            page.getByRole('dialog', {name: 'Schedule message'}),
        );
        this.userProfilePopover = new components.UserProfilePopover(page.locator('.user-profile-popover'));

        // Posts
        this.postContainer = page.locator('div.post-message__text');

        page.locator('#channelHeaderDropdownMenu');
    }

    async toBeVisible() {
        await this.centerView.toBeVisible();
    }

    async getLastPost() {
        return this.centerView.getLastPost();
    }

    async getInvitePeopleModal(teamDisplayName: string) {
        this.invitePeopleModal = new components.InvitePeopleModal(
            this.page.getByRole('dialog', {name: `Invite people to ${teamDisplayName}`}),
        );
        return this.invitePeopleModal;
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

        return channelsUrl;
    }

    /**
     * `postMessage` posts a message in the current channel
     * @param message Message to post
     * @param files Files to attach to the message
     */
    async postMessage(message: string, files?: string[]) {
        await this.centerView.postMessage(message, files);
    }

    async replyToLastPost(message: string) {
        const rootPost = await this.getLastPost();
        await rootPost.reply();

        const sidebarRight = this.sidebarRight;
        await sidebarRight.toBeVisible();
        await sidebarRight.postMessage('Replying to a thread');

        // * Verify the message has been sent
        await waitUntil(
            async () => {
                const post = await this.sidebarRight.getLastPost();
                const content = await post.container.textContent();

                return content?.includes(message);
            },
            {timeout: duration.ten_sec},
        );

        const lastPost = await sidebarRight.getLastPost();

        return {rootPost, sidebarRight, lastPost};
    }

    async openChannelSettings(): Promise<ChannelSettingsModal> {
        await this.centerView.header.openChannelMenu();
        await this.page.locator('#channelSettings[role="menuitem"]').click();
        await this.channelSettingsModal.toBeVisible();

        return this.channelSettingsModal;
    }

    async openSettings(): Promise<SettingsModal> {
        await this.globalHeader.openSettings();
        await this.settingsModal.toBeVisible();
        return this.settingsModal;
    }

    async newChannel(name: string, channelType: string) {
        await this.page.locator('#browseOrAddChannelMenuButton').click();
        await this.page.locator('#createNewChannelMenuItem').click();
        await this.page.locator('#input_new-channel-modal-name').fill(name);

        if (channelType === 'P') {
            await this.page.locator('#public-private-selector-button-P').click();
        } else {
            await this.page.locator('#public-private-selector-button-O').click();
        }

        await this.page.getByText('Create channel').click();
    }

    async openUserAccountMenu() {
        await this.userAccountMenuButton.click();
        await expect(this.userAccountMenu.container).toBeVisible();
        return this.userAccountMenu;
    }

    async openProfileModal() {
        await this.openUserAccountMenu();
        await this.userAccountMenu.profile.click();
        await expect(this.profileModal.container).toBeVisible();
        return this.profileModal;
    }

    async openProfilePopover(post: ChannelsPost) {
        // Find and click the post's user avatar to open the profile popover
        await post.hover();
        await post.profileIcon.click();

        // Wait for the profile popover to be visible
        const popover = this.userProfilePopover;
        await expect(popover.container).toBeVisible();

        return popover;
    }

    async scheduleMessage(message: string, dayFromToday: number = 0, timeOptionIndex: number = 0) {
        await this.centerView.postCreate.writeMessage(message);

        await expect(this.centerView.postCreate.scheduleMessageButton).toBeVisible();
        await this.centerView.postCreate.scheduleMessageButton.click();

        await this.scheduleMessageMenu.toBeVisible();
        await this.scheduleMessageMenu.selectCustomTime();

        return await this.scheduleMessageModal.scheduleMessage(dayFromToday, timeOptionIndex);
    }

    async scheduleMessageFromThread(message: string, dayFromToday: number = 0, timeOptionIndex: number = 0) {
        await this.sidebarRight.postCreate.writeMessage(message);

        await expect(this.sidebarRight.postCreate.scheduleMessageButton).toBeVisible();
        await this.sidebarRight.postCreate.scheduleMessageButton.click();

        await this.scheduleMessageMenu.toBeVisible();
        await this.scheduleMessageMenu.selectCustomTime();

        return await this.scheduleMessageModal.scheduleMessage(dayFromToday, timeOptionIndex);
    }
}
