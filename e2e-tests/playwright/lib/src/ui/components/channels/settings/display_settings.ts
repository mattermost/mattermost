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

    constructor(container: Locator) {
        this.container = container;
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
