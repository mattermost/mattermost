// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import en from '@/i18n';
import {BaseComponent} from '@/ui/base_component';

export default class ChannelInfoRhs extends BaseComponent {
    readonly favoriteButton: Locator;
    readonly muteButton: Locator;
    readonly copyLinkButton: Locator;
    readonly addPeopleButton: Locator;
    readonly channelSettingsMenuItem: Locator;
    readonly notificationPreferencesMenuItem: Locator;
    readonly membersMenuItem: Locator;
    readonly pinnedMessagesMenuItem: Locator;
    readonly filesMenuItem: Locator;
    readonly closeButton: Locator;

    constructor(container: Locator) {
        super(container);

        this.favoriteButton = container.locator('#channelInfoRHSAddFavoriteButton');
        this.muteButton = container.locator('#channelInfoRHSMuteChannelButton');
        this.copyLinkButton = container.getByRole('button', {name: en['channel_info_rhs.top_buttons.copy']});
        this.addPeopleButton = container.locator('#channelInfoRHSAddPeopleButton');
        this.channelSettingsMenuItem = container.locator('#channelInfoRHSChannelSettings');
        this.notificationPreferencesMenuItem = container.locator('#channelInfoRHSNotificationSettings');
        this.membersMenuItem = container.getByRole('menuitem', {name: en['channel_info_rhs.menu.members']});
        this.pinnedMessagesMenuItem = container.getByRole('menuitem', {name: en['channel_info_rhs.menu.pinned']});
        this.filesMenuItem = container.getByRole('menuitem', {name: en['channel_info_rhs.menu.files']});
        this.closeButton = container.locator('#rhsCloseButton');
    }

    async toBeVisible(): Promise<void> {
        await expect(this.container).toBeVisible();
    }
}
