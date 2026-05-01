// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

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
    oneClickReactions: 'Quick reactions on messages',
    emojiPicker: 'Render emoticons as emojis',
    language: 'Language',
};

export default class DisplaySettings {
    readonly container: Locator;

    readonly title;
    public id = '#displaySettings';
    readonly expandedSection;
    public expandedSectionId = '.section-max';

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
    readonly oneClickReactionsEditButton;
    readonly emojiPickerEditButton;
    readonly languageEditButton;

    constructor(container: Locator) {
        this.container = container;

        this.title = container.getByRole('heading', {name: 'Display Settings', exact: true});
        this.expandedSection = container.locator(this.expandedSectionId);

        // Edit buttons for each setting section - IDs are {section}Edit pattern from webapp
        this.themeEditButton = container.locator('#themeEdit');
        this.clockDisplayEditButton = container.locator('#clockEdit');
        this.teammateNameDisplayEditButton = container.locator('#name_formatEdit');
        this.availabilityStatusOnPostsEditButton = container.locator('#availabilityStatusEdit');
        this.lastActiveTimeEditButton = container.locator('#lastactiveEdit');
        this.timezoneEditButton = container.locator('#timezoneEdit');
        this.showLinkPreviewsEditButton = container.locator('#linkpreviewEdit');
        this.collapseImagePreviewsEditButton = container.locator('#collapseEdit');
        this.messageDisplayEditButton = container.locator('#message_displayEdit');
        this.clickToReplyEditButton = container.locator('#click_to_replyEdit');
        this.channelDisplayModeEditButton = container.locator('#channel_display_modeEdit');
        this.oneClickReactionsEditButton = container.locator('#one_click_reactions_enabledEdit');
        this.emojiPickerEditButton = container.locator('#renderEmoticonsAsEmojiEdit');
        this.languageEditButton = container.locator('#languagesEdit');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async expandSection(section: DisplaySettingsSection) {
        await this.container.getByText(sectionTitles[section]).click();
        await this.verifySectionIsExpanded(section);
    }

    async verifySectionIsExpanded(section: DisplaySettingsSection) {
        await expect(this.container.locator('.section-min', {hasText: sectionTitles[section]})).not.toBeVisible();

        await expect(this.container.locator('.section-max', {hasText: sectionTitles[section]})).toBeVisible();
    }
}
