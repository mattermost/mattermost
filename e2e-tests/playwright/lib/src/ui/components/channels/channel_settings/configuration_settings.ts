// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

export default class ConfigurationSettings {
    readonly container: Locator;

    constructor(container: Locator) {
        this.container = container;
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async save() {
        const saveButton = this.container.getByTestId('SaveChangesPanel__save-btn');
        await expect(saveButton).toBeVisible();
        await saveButton.click();
    }

    async enableChannelBanner() {
        const toggleButton = await this.container.getByTestId('channelBannerToggle-button');
        const classes = await toggleButton.getAttribute('class');
        if (!classes?.includes('active')) {
            await toggleButton.click();
        }
    }

    async disableChannelBanner() {
        const toggleButton = await this.container.getByTestId('channelBannerToggle-button');
        const classes = await toggleButton.getAttribute('class');
        if (classes?.includes('active')) {
            await toggleButton.click();
        }
    }

    async setChannelBannerText(text: string) {
        const textBox = await this.container.getByTestId('channel_banner_banner_text_textbox');
        await expect(textBox).toBeVisible();
        await textBox.fill(text);
    }

    async setChannelBannerTextColor(color: string) {
        const colorInput = await this.container.locator(
            '#channel_banner_banner_background_color_picker-inputColorValue',
        );
        await expect(colorInput).toBeVisible();
        await colorInput.fill(color);
    }
}
