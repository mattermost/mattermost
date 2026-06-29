// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import {expect} from '@playwright/test';
import {waitUntil} from 'async-wait-until';

import type {
    ChannelsPost,
    SettingsModal,
    TeamSettingsModal,
    InvitePeopleModal,
    MembersInvitedModal,
} from '@/ui/components';
import {
    BrowseChannelsModal,
    ChannelBookmarks,
    ChannelInfoRhs,
    ChannelNotificationsModal,
    ChannelSearchResults,
    ChannelSettingsModal,
    CreateTeamForm,
    NewChannelModal,
    UserGroupsModal,
    components,
} from '@/ui/components';
import {CustomProfileAttributes} from '@/ui/components/channels/profile_modal';
import {duration} from '@/util';
import en from '@/i18n';

import type {BaseComponent} from '../base_component';
import {BasePage} from '../base_page';

export default class ChannelsPage extends BasePage {
    readonly channels = 'Channels';

    readonly components: Record<string, BaseComponent>;

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
    readonly createTeamForm;
    readonly deletePostModal;
    readonly findChannelsModal;
    readonly newChannelModal;
    readonly browseChannelsModal;
    readonly directChannelsModal;
    public invitePeopleModal: InvitePeopleModal | undefined;
    public membersInvitedModal: MembersInvitedModal | undefined;
    readonly profileModal;
    readonly settingsModal;
    readonly teamSettingsModal;
    readonly scheduledDraftModal;
    readonly scheduleMessageModal;
    readonly burnOnReadConfirmationModal;
    readonly channelBookmarks;
    readonly channelInfoRhs;
    readonly channelNotificationsModal;
    readonly channelSearchResults;
    readonly userGroupsModal;
    readonly archivedChannelMessage;

    readonly postContainer;
    readonly postDotMenu;
    readonly postReminderMenu;
    readonly userAccountMenu;
    readonly teamMenu;

    readonly emojiGifPickerPopup;
    readonly scheduleMessageMenu;
    readonly confirmModal;
    readonly teamPolicyConfirmationModal;
    readonly teamPolicyDeleteModal;
    readonly channelSelectorModal;
    readonly testResultsModal;
    readonly channelAccessRulesConfirmModal;
    readonly attributeSelectorMenu;
    readonly customProfileAttributes: CustomProfileAttributes;

    constructor(page: Page) {
        super(page);

        // The main areas of the app
        this.globalHeader = new components.GlobalHeader(this, page.locator('#global-header'));
        this.searchBox = new components.SearchBox(page.locator('#searchBox'));
        this.centerView = new components.ChannelsCenterView(page.getByTestId('channel_view'), page);
        this.sidebarLeft = new components.ChannelsSidebarLeft(page.locator('#SidebarContainer'));
        this.sidebarRight = new components.ChannelsSidebarRight(page.locator('#sidebar-right'));
        this.appBar = new components.ChannelsAppBar(page.getByTestId('appBar'));
        this.messagePriority = new components.MessagePriority(page.locator('body'));
        this.userAccountMenuButton = page.getByRole('button', {name: en['userAccountMenu.menuButton.ariaLabel']});

        // Modals
        this.channelSettingsModal = new ChannelSettingsModal(
            page.getByRole('dialog', {name: en['channel_settings.modal.title']}),
        );
        this.createTeamForm = new CreateTeamForm(page.getByTestId('createTeamContainer'));
        this.deletePostModal = new components.DeletePostModal(page.locator('#deletePostModal'));
        this.findChannelsModal = new components.FindChannelsModal(
            page.getByRole('dialog', {name: en['quick_switch_modal.switchChannels']}),
        );
        this.newChannelModal = new NewChannelModal(page.getByRole('dialog', {name: en['channel_modal.modalTitle']}));
        this.browseChannelsModal = new BrowseChannelsModal(page.getByRole('dialog', {name: en['more_channels.title']}));
        this.directChannelsModal = new components.DirectChannelsModal(
            page.getByRole('dialog', {name: en['more_direct_channels.title']}),
        );
        this.profileModal = new components.ProfileModal(
            page.getByRole('dialog', {name: en['user.settings.modal.title']}),
        );
        this.settingsModal = new components.SettingsModal(
            page.getByRole('dialog', {name: en['channel_header.settings']}),
        );
        this.teamSettingsModal = new components.TeamSettingsModal(
            page.getByRole('dialog', {name: en['team_settings_modal.title']}),
        );
        this.burnOnReadConfirmationModal = new components.BurnOnReadConfirmationModal(
            page.getByRole('dialog').filter({hasText: /burn|delete/i}),
        );
        this.channelBookmarks = new ChannelBookmarks(page.getByTestId('channel-bookmarks-container'));
        this.channelInfoRhs = new ChannelInfoRhs(page.locator('#rhsContainer'));
        this.channelNotificationsModal = new ChannelNotificationsModal(
            page.getByRole('dialog', {name: en['channel_notifications.preferences']}),
        );
        this.channelSearchResults = new ChannelSearchResults(page.locator('#sidebar-right'));
        this.userGroupsModal = new UserGroupsModal(page.locator('#userGroupsModal'));

        // Menus
        this.postDotMenu = new components.PostDotMenu(page.getByRole('menu', {name: en['post_info.menuAriaLabel']}));
        this.postReminderMenu = new components.PostReminderMenu(
            page.getByRole('menu', {name: en['post_info.post_reminder.sub_menu.header']}),
        );
        this.userAccountMenu = new components.UserAccountMenu(page.locator('#userAccountMenu'));
        this.scheduleMessageMenu = new components.ScheduleMessageMenu(page.locator('#dropdown_send_post_options'));
        this.teamMenu = new components.TeamMenu(page.locator('#sidebarTeamMenu'));

        // Popovers
        this.emojiGifPickerPopup = new components.EmojiGifPicker(page.locator('#emojiGifPicker'));
        this.scheduledDraftModal = new components.ScheduledDraftModal(page.locator('div.modal-content'));
        this.scheduleMessageModal = new components.ScheduleMessageModal(
            page.getByRole('dialog', {name: en['schedule_post.custom_time_modal.title']}),
        );
        this.userProfilePopover = new components.UserProfilePopover(page.getByTestId('userProfilePopover'));

        // Posts
        this.postContainer = page.locator('div.post-message__text');
        this.archivedChannelMessage = page.locator('#channelArchivedMessage');

        page.locator('#channelHeaderDropdownMenu');

        // Modals reachable from channels page
        this.confirmModal = page.locator('#confirmModal');

        // Team policy modals
        this.teamPolicyConfirmationModal = page.locator('#teamPolicyConfirmationModal');
        this.teamPolicyDeleteModal = page.locator('#teamPolicyDeleteModal');
        this.channelSelectorModal = page.locator('#channelSelectorModal');
        this.testResultsModal = page.locator('#testResultsModal');
        this.channelAccessRulesConfirmModal = page.locator('#channel-access-rules-confirm-modal');
        this.attributeSelectorMenu = page.locator('[id^="attribute-selector-menu"]');

        // Custom profile attributes (in user settings general tab)
        this.customProfileAttributes = new CustomProfileAttributes(page.getByTestId('userSettings'));

        this.components = {
            globalHeader: this.globalHeader,
            searchBox: this.searchBox,
            centerView: this.centerView,
            sidebarLeft: this.sidebarLeft,
            sidebarRight: this.sidebarRight,
            appBar: this.appBar,
            messagePriority: this.messagePriority,
            channelSettingsModal: this.channelSettingsModal,
            createTeamForm: this.createTeamForm,
            deletePostModal: this.deletePostModal,
            findChannelsModal: this.findChannelsModal,
            newChannelModal: this.newChannelModal,
            browseChannelsModal: this.browseChannelsModal,
            directChannelsModal: this.directChannelsModal,
            profileModal: this.profileModal,
            settingsModal: this.settingsModal,
            teamSettingsModal: this.teamSettingsModal,
            burnOnReadConfirmationModal: this.burnOnReadConfirmationModal,
            channelBookmarks: this.channelBookmarks,
            channelInfoRhs: this.channelInfoRhs,
            channelNotificationsModal: this.channelNotificationsModal,
            channelSearchResults: this.channelSearchResults,
            userGroupsModal: this.userGroupsModal,
            postDotMenu: this.postDotMenu,
            postReminderMenu: this.postReminderMenu,
            userAccountMenu: this.userAccountMenu,
            scheduleMessageMenu: this.scheduleMessageMenu,
            teamMenu: this.teamMenu,
            emojiGifPickerPopup: this.emojiGifPickerPopup,
            scheduledDraftModal: this.scheduledDraftModal,
            scheduleMessageModal: this.scheduleMessageModal,
            userProfilePopover: this.userProfilePopover,
            customProfileAttributes: this.customProfileAttributes,
        };
    }

    async toBeVisible() {
        await this.centerView.toBeVisible();
    }

    /**
     * `toNotContainText` verifies if the page does not contain the specified text.
     * @param text Text to be verified not in the page
     */
    async toNotContainText(text: string) {
        await expect(this.page.locator('body')).not.toContainText(text);
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

    async getMembersInvitedModal(teamDisplayName: string) {
        this.membersInvitedModal = new components.MembersInvitedModal(
            this.page.getByRole('dialog', {name: `invited to ${teamDisplayName}`}),
        );
        return this.membersInvitedModal;
    }

    async goto(teamName = '', channelName = ''): Promise<void> {
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

    // Force the /messages route for group-message slugs that do not start with '@'.
    async gotoMessage(teamName: string, channelName: string): Promise<void> {
        const channelsUrl = `/${teamName}/messages/${channelName}`;
        await this.page.goto(channelsUrl);
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

    async openTeamSettings(): Promise<TeamSettingsModal> {
        await this.page.locator('#sidebarTeamMenuButton').click();
        await this.page.getByText(en['sidebarLeft.teamMenu.teamSettingsMenuItem.primaryLabel']).first().click();
        await this.teamSettingsModal.toBeVisible();

        return this.teamSettingsModal;
    }

    async openChannelSettings(): Promise<ChannelSettingsModal> {
        await this.centerView.header.openChannelMenu();

        const channelSettingsMenuItem = this.page.getByRole('menuitem', {
            name: en['channel_settings.modal.title'],
        });
        const moreActionsMenuItem = this.page.getByRole('menuitem', {name: en['pluginsMenu.more_actions']});

        const channelSettingsVisible = await channelSettingsMenuItem.isVisible({timeout: 1500}).catch(() => false);
        if (!channelSettingsVisible) {
            const moreActionsVisible = await moreActionsMenuItem.isVisible({timeout: 1500}).catch(() => false);
            if (moreActionsVisible) {
                await moreActionsMenuItem.click();
            }
        }

        await expect(channelSettingsMenuItem).toBeVisible();
        await channelSettingsMenuItem.click();
        await this.channelSettingsModal.toBeVisible();

        return this.channelSettingsModal;
    }

    async openSettings(): Promise<SettingsModal> {
        await this.globalHeader.openSettings();
        await this.settingsModal.toBeVisible();
        return this.settingsModal;
    }

    async openNewChannelModal(): Promise<NewChannelModal> {
        await this.sidebarLeft.browseOrCreateChannelButton.click();
        await this.page.getByText(en['sidebar_left.add_channel_dropdown.createNewChannel']).click();
        await this.newChannelModal.toBeVisible();

        return this.newChannelModal;
    }

    async openBrowseChannelsModal(): Promise<BrowseChannelsModal> {
        await this.sidebarLeft.browseOrCreateChannelButton.click();
        await this.page.getByText(en['sidebar_left.add_channel_dropdown.browseChannels']).click();
        await this.browseChannelsModal.toBeVisible();

        return this.browseChannelsModal;
    }

    async openDirectChannelsModal() {
        await this.sidebarLeft.openDirectMessageButton.click();
        await this.directChannelsModal.toBeVisible();

        return this.directChannelsModal;
    }

    async openCreateTeamForm(): Promise<CreateTeamForm> {
        await this.sidebarLeft.teamMenuButton.click();
        await this.teamMenu.toBeVisible();
        await this.teamMenu.clickCreateTeam();
        await this.createTeamForm.toBeVisible();

        return this.createTeamForm;
    }

    async newChannel(name: string, channelType: string) {
        const newChannelModal = await this.openNewChannelModal();
        await newChannelModal.displayNameInput.fill(name);

        if (channelType === 'P') {
            await newChannelModal.privateTypeButton.click();
        } else {
            await newChannelModal.publicTypeButton.click();
        }

        await newChannelModal.create();
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

        return this.scheduleMessageModal.scheduleMessage(dayFromToday, timeOptionIndex);
    }

    async scheduleMessageFromThread(message: string, dayFromToday: number = 0, timeOptionIndex: number = 0) {
        await this.sidebarRight.postCreate.writeMessage(message);

        await expect(this.sidebarRight.postCreate.scheduleMessageButton).toBeVisible();
        await this.sidebarRight.postCreate.scheduleMessageButton.click();

        await this.scheduleMessageMenu.toBeVisible();
        await this.scheduleMessageMenu.selectCustomTime();

        return this.scheduleMessageModal.scheduleMessage(dayFromToday, timeOptionIndex);
    }

    getPostById(postId: string) {
        return this.page.locator(`[id="post_${postId}"]`);
    }

    async getFlaggedPostViewDetailButton(flaggedPostId: string) {
        return this.page.getByTestId(`data-spillage-action-view-details_${flaggedPostId}`);
    }
}
