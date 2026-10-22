// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export default class EmojiGifPicker {
    readonly container: Locator;

    readonly gifTab: Locator;
    readonly gifSearchInput: Locator;
    readonly gifPickerItems: Locator;
    readonly emojiSearchInput: Locator;

    constructor(container: Locator) {
        this.container = container;

        this.gifTab = container.getByText('GIFs');
        this.gifSearchInput = container.getByPlaceholder('Search GIPHY');
        this.gifPickerItems = container.getByTestId('gif-picker-items');
        this.emojiSearchInput = container.getByPlaceholder('Search emojis');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    /**
     * Types into the emoji picker search field to filter emojis.
     */
    async searchEmoji(text: string) {
        await expect(this.emojiSearchInput).toBeVisible();
        await this.emojiSearchInput.fill(text);
    }

    /**
     * Returns the picker button for an emoji by its name, e.g. "taxi".
     */
    getEmoji(emojiName: string) {
        return this.container.getByRole('button', {name: `${emojiName} emoji`, exact: true});
    }

    async notToBeVisible() {
        await expect(this.container).not.toBeVisible();
    }

    async clickEmoji(emojiName: string) {
        await this.getEmoji(emojiName).click();
    }

    async openGifTab() {
        await expect(this.gifTab).toBeVisible();

        await this.gifTab.click({force: true});

        await expect(this.gifSearchInput).toBeVisible();
        await expect(this.gifPickerItems).toBeVisible();
    }

    async searchGif(name: string) {
        await this.gifSearchInput.fill(name);
        await expect(this.gifSearchInput).toHaveValue(name);
    }

    async getNthGif(n: number) {
        await expect(this.gifPickerItems).toBeVisible();

        await this.gifPickerItems.getByRole('img').nth(n).waitFor();
        const nthGif = this.gifPickerItems.getByRole('img').nth(n);
        await expect(nthGif).toBeVisible();

        const nthGifSrc = await nthGif.getAttribute('src');
        const nthGifAlt = await nthGif.getAttribute('alt');

        if (!nthGifSrc || !nthGifAlt) {
            throw new Error('Gif src or alt is empty');
        }

        return {
            src: nthGifSrc,
            alt: nthGifAlt,
            img: nthGif,
        };
    }
}
