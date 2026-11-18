// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@/aria/matchers';
import type {App} from '@/ui/generated';

type TeamSettings = App['teamSettingsModal'];
type TeamSettingsTab = Parameters<TeamSettings['tabs']['tab']>[0];
type ChannelSettings = App['channelSettingsModal'];
type ChannelSettingsTab = Parameters<ChannelSettings['tabs']['tab']>[0];

/** Opens Team Settings and waits for the requested tab to be selected. */
export async function openTeamSettings(app: App, tab: TeamSettingsTab = 'info'): Promise<TeamSettings> {
    await app.lhs.header.openTeamMenuButton.clickTo(app.lhs.teamMenu);
    await app.lhs.teamMenu.teamSettingsMenuItem.click();
    const settings = app.teamSettingsModal;
    await expect(settings).toBeVisible();
    await settings.tabs.tab(tab).select();
    await expect(settings.tabs.tab(tab)).toBeSelected();
    await expect(settings.tabs.tab(tab)).toBeSelected();
    return settings;
}

/** Closes Team Settings and waits for the dialog to disappear. */
export async function closeTeamSettings(settings: TeamSettings): Promise<void> {
    await settings.closeButton.click();
    await expect(settings).not.toBeVisible();
    await expect(settings).not.toBeVisible();
}

/** Opens Channel Settings and waits for the requested tab to be selected. */
export async function openChannelSettings(app: App, tab: ChannelSettingsTab = 'info'): Promise<ChannelSettings> {
    await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.channelSettingsMenuItem);
    await app.channelHeader.menu.channelSettingsMenuItem.click();
    const settings = app.channelSettingsModal;
    await expect(settings).toBeVisible();
    await settings.tabs.tab(tab).select();
    await expect(settings.tabs.tab(tab)).toBeSelected();
    await expect(settings.tabs.tab(tab)).toBeSelected();
    return settings;
}
