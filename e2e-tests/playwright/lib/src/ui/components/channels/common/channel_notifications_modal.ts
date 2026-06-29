// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import en from '@/i18n';
import {BaseComponent} from '@/ui/base_component';

export default class ChannelNotificationsModal extends BaseComponent {
    readonly muteChannelCheckbox: Locator;
    readonly ignoreMentionsCheckbox: Locator;
    readonly mutedBanner: Locator;
    readonly saveButton: Locator;
    readonly cancelButton: Locator;

    constructor(container: Locator) {
        super(container);

        this.muteChannelCheckbox = container.getByLabel(en['channel_notifications.muteChannelTitle']);
        this.ignoreMentionsCheckbox = container.getByLabel(en['channel_notifications.ignoreMentionsTitle']);
        this.mutedBanner = container.locator('#channelNotificationsMutedBanner');
        this.saveButton = container.getByRole('button', {name: en['generic_btn.save']});
        this.cancelButton = container.getByRole('button', {name: en['generic_btn.cancel']});
    }

    async toBeVisible(): Promise<void> {
        await expect(this.container).toBeVisible();
    }

    getDesktopResetButton(): Locator {
        return this.container.getByTestId('resetToDefaultButton-Desktop');
    }

    getMobileResetButton(): Locator {
        return this.container.getByTestId('resetToDefaultButton-Mobile');
    }

    getMobileNotifyMeSection(): Locator {
        return this.container.getByTestId('mobile-notify-me-radio-section');
    }

    async save(): Promise<void> {
        await this.saveButton.click();
    }

    async cancel(): Promise<void> {
        await this.cancelButton.click();
    }
}
