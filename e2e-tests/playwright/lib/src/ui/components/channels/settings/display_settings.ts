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
    language: 'Language',
};

export default class DisplaySettings {
    readonly container: Locator;

    readonly title;
    public id = '#displaySettings';
    readonly expandedSection;
    public expandedSectionId = '.section-max';

    readonly themeEditButton;
    readonly collapsedReplyThreadsEditButton;
    readonly clockDisplayEditButton;
    readonly teammateNameDisplayEditButton;
    readonly timezoneEditButton;
    readonly languageEditButton;

    constructor(container: Locator) {
        this.container = container;

        this.title = container.getByRole('heading', {name: 'Display Settings', exact: true});
        this.expandedSection = container.locator(this.expandedSectionId);

        // Edit buttons for each setting section
        this.themeEditButton = container.locator('#themeEdit');
        this.collapsedReplyThreadsEditButton = container.locator('#collapsedReplyThreadsEdit');
        this.clockDisplayEditButton = container.locator('#clockDisplayEdit');
        this.teammateNameDisplayEditButton = container.locator('#teammateNameDisplayEdit');
        this.timezoneEditButton = container.locator('#timezoneEdit');
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
