// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {createSurface} from '../../../../surface';

export type DisplaySettingsSection =
    | 'theme'
    | 'clockDisplay'
    | 'teammateNameDisplay'
    | 'availabilityStatusOnPosts'
    | 'lastActiveTime'
    | 'timezone'
    | 'showLinkPreviews'
    | 'collapseImagePreviews'
    | 'messageDisplay'
    | 'clickToReply'
    | 'channelDisplayMode'
    | 'collapseCategoryWithUnreads'
    | 'oneClickReactions'
    | 'emojiPicker'
    | 'language';

const sectionTitles: Record<DisplaySettingsSection, string> = {
    theme: 'Theme',
    clockDisplay: 'Clock Display',
    teammateNameDisplay: 'Teammate Name Display',
    availabilityStatusOnPosts: 'Show online availability on profile images',
    lastActiveTime: 'Share last active time',
    timezone: 'Timezone',
    showLinkPreviews: 'Website Link Previews',
    collapseImagePreviews: 'Default Appearance of Image Previews',
    messageDisplay: 'Message Display',
    clickToReply: 'Click to open threads',
    channelDisplayMode: 'Channel Display',
    collapseCategoryWithUnreads: 'Collapse category with unread channels',
    oneClickReactions: 'Quick reactions on messages',
    emojiPicker: 'Render emoticons as emojis',
    language: 'Language',
};

export default class DisplaySettings {
    readonly container: Locator;

    readonly title;
    public id = '#displaySettings';
    public expandedSectionId = '.section-max';
    readonly expandedSection;

    readonly themeEditButton;
    readonly clockDisplayEditButton;
    readonly teammateNameDisplayEditButton;
    readonly availabilityStatusOnPostsEditButton;
    readonly lastActiveTimeEditButton;
    readonly timezoneEditButton;
    readonly showLinkPreviewsEditButton;
    readonly collapseImagePreviewsEditButton;
    readonly messageDisplayEditButton;
    readonly clickToReplyEditButton;
    readonly channelDisplayModeEditButton;
    readonly collapseCategoryWithUnreadsEditButton;
    readonly oneClickReactionsEditButton;
    readonly emojiPickerEditButton;
    readonly languageEditButton;

    private readonly settingItem;

    constructor(container: Locator) {
        this.container = container;

        this.title = container.getByRole('heading', {name: 'Display Settings', exact: true});
        this.expandedSection = container.locator('section');

        // Shared SettingItemMin Edit buttons, keyed by the webapp `section` prop and scoped by this tab.
        this.settingItem = createSurface(container.page()).setting_item(container);
        const edit = (section: string) => this.settingItem.edit(section).locator;
        this.themeEditButton = edit('theme');
        this.clockDisplayEditButton = edit('clock');
        this.teammateNameDisplayEditButton = edit('name_format');
        this.availabilityStatusOnPostsEditButton = edit('availabilityStatus');
        this.lastActiveTimeEditButton = edit('lastactive');
        this.timezoneEditButton = edit('timezone');
        this.showLinkPreviewsEditButton = edit('linkpreview');
        this.collapseImagePreviewsEditButton = edit('collapse');
        this.messageDisplayEditButton = edit('message_display');
        this.clickToReplyEditButton = edit('click_to_reply');
        this.channelDisplayModeEditButton = edit('channel_display_mode');
        this.collapseCategoryWithUnreadsEditButton = edit('collapse_category_with_unreads');
        this.oneClickReactionsEditButton = edit('one_click_reactions_enabled');
        this.emojiPickerEditButton = edit('renderEmoticonsAsEmoji');
        this.languageEditButton = edit('languages');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async expandSection(section: DisplaySettingsSection) {
        await this.container.getByText(sectionTitles[section]).click();
        await this.verifySectionIsExpanded(section);
    }

    async verifySectionIsExpanded(section: DisplaySettingsSection) {
        await expect(
            this.container.getByTestId('section-min').filter({hasText: sectionTitles[section]}),
        ).not.toBeVisible();

        await expect(this.container.locator('section', {hasText: sectionTitles[section]})).toBeVisible();
    }

    async selectPremadeTheme(theme: 'Denim' | 'Sapphire' | 'Quartz' | 'Indigo' | 'Onyx') {
        await this.themeEditButton.click();
        await this.verifySectionIsExpanded('theme');
        await this.container.getByRole('button', {name: theme}).click();
        await this.settingItem.save.click();
    }
}
