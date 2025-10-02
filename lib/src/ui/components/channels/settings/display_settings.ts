// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

export type DisplaySettingsSection =
    | 'theme'
    | 'collapsedReplyThreads'
    | 'clockDisplay'
    | 'teammateNameDisplay'
    | 'availabilityStatusOnPosts'
    | 'lastActiveTime'
    | 'timezone'
    | 'showLinkPreviews'
    | 'collapseImagePreviews'
    | 'clickToReply'
    | 'channelDisplayMode'
    | 'oneClickReactions'
    | 'renderEmoticons'
    | 'language';

const sectionTitles: Record<DisplaySettingsSection, string> = {
    theme: 'Theme',
    collapsedReplyThreads: 'Threaded Discussions',
    clockDisplay: 'Clock Display',
    teammateNameDisplay: 'Teammate Name Display',
    availabilityStatusOnPosts: 'Show online availability on profile images',
    lastActiveTime: 'Share last active time',
    timezone: 'Timezone',
    showLinkPreviews: 'Website Link Previews',
    collapseImagePreviews: 'Default Appearance of Image Previews',
    clickToReply: 'Click to open threads',
    channelDisplayMode: 'Channel Display',
    oneClickReactions: 'Quick reactions on messages',
    renderEmoticons: 'Render emoticons as emojis',
    language: 'Language',
};

export default class DisplaySettings {
    readonly container: Locator;
    readonly id: string;
    readonly expandedSection: Locator;
    readonly expandedSectionId: string;

    // Edit buttons for each section
    readonly themeEditButton: Locator;
    readonly clockDisplayEditButton: Locator;
    readonly teammateNameDisplayEditButton: Locator;
    readonly availabilityStatusEditButton: Locator;
    readonly lastActiveTimeEditButton: Locator;
    readonly timezoneEditButton: Locator;
    readonly linkPreviewsEditButton: Locator;
    readonly imagePreviewsEditButton: Locator;
    readonly messageDisplayEditButton: Locator;
    readonly clickToReplyEditButton: Locator;
    readonly channelDisplayEditButton: Locator;
    readonly quickReactionsEditButton: Locator;
    readonly renderEmotesEditButton: Locator;
    readonly languageEditButton: Locator;

    constructor(container: Locator) {
        this.container = container;
        this.id = 'display_settings';
        this.expandedSection = container.locator('.section-max');
        this.expandedSectionId = 'expanded_section';

        // Initialize edit buttons with appropriate role-based locators
        this.themeEditButton = container.getByRole('button', {name: /Theme Edit/});
        this.clockDisplayEditButton = container.getByRole('button', {name: /Clock Display Edit/});
        this.teammateNameDisplayEditButton = container.getByRole('button', {name: /Teammate Name Display Edit/});
        this.availabilityStatusEditButton = container.getByRole('button', {name: /Show online availability.*Edit/});
        this.lastActiveTimeEditButton = container.getByRole('button', {name: /Share last active time Edit/});
        this.timezoneEditButton = container.getByRole('button', {name: /Timezone Edit/});
        this.linkPreviewsEditButton = container.getByRole('button', {name: /Website Link Previews Edit/});
        this.imagePreviewsEditButton = container.getByRole('button', {name: /Default Appearance.*Edit/});
        this.messageDisplayEditButton = container.getByRole('button', {name: /Message Display Edit/});
        this.clickToReplyEditButton = container.getByRole('button', {name: /Click to open threads Edit/});
        this.channelDisplayEditButton = container.getByRole('button', {name: /Channel Display Edit/});
        this.quickReactionsEditButton = container.getByRole('button', {name: /Quick reactions.*Edit/});
        this.renderEmotesEditButton = container.getByRole('button', {name: /Render emoticons.*Edit/});
        this.languageEditButton = container.getByRole('button', {name: /Language Edit/});
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
