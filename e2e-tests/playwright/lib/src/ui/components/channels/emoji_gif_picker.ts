// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

/**
 * Skin tone values as used by the emoji picker's skin tone selector, either
 * 'default' or the unified codepoint of the skin tone modifier.
 */
export const skinTones = ['default', '1F3FB', '1F3FC', '1F3FD', '1F3FE', '1F3FF'] as const;

export type SkinTone = (typeof skinTones)[number];

export default class EmojiGifPicker {
    readonly container: Locator;

    readonly gifTab: Locator;
    readonly gifSearchInput: Locator;
    readonly gifPickerItems: Locator;
    readonly emojiSearchInput: Locator;

    readonly skinToneExpandButton: Locator;
    readonly skinToneCloseButton: Locator;
    readonly skinToneChoices: Locator;

    constructor(container: Locator) {
        this.container = container;

        this.gifTab = container.getByText('GIFs');
        this.gifSearchInput = container.getByPlaceholder('Search GIPHY');
        this.gifPickerItems = container.getByTestId('gif-picker-items');
        this.emojiSearchInput = container.getByPlaceholder('Search emojis');

        this.skinToneExpandButton = container.getByRole('button', {name: 'Skin tone', exact: true});
        this.skinToneCloseButton = container.getByRole('button', {name: 'Close skin tones', exact: true});
        this.skinToneChoices = container.getByRole('region', {name: 'Skin tone icons'});
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

    /**
     * Returns the collapsed skin tone selector button for the given skin tone.
     * The button carries the "skin-picked" test ID only while the selector is
     * collapsed, so this also verifies the collapsed state.
     */
    getSelectedSkinTone(skinTone: SkinTone) {
        return this.container.getByTestId(`skin-picked-${skinTone}`);
    }

    /**
     * Returns the button for a skin tone in the expanded skin tone selector.
     */
    getSkinToneChoice(skinTone: SkinTone) {
        return this.container.getByTestId(`skin-pick-${skinTone}`);
    }

    /**
     * Expands the skin tone selector so that all skin tone choices are visible.
     */
    async openSkinToneSelector() {
        await expect(this.skinToneExpandButton).toBeVisible();
        await this.skinToneExpandButton.click();
        await expect(this.skinToneChoices).toBeVisible();
    }

    /**
     * Collapses the skin tone selector without changing the selected skin tone.
     */
    async closeSkinToneSelector() {
        await expect(this.skinToneCloseButton).toBeVisible();
        await this.skinToneCloseButton.click();
        await expect(this.skinToneChoices).not.toBeVisible();
    }

    /**
     * Selects a skin tone from the expanded skin tone selector, then verifies
     * that the selector collapses with the chosen skin tone applied.
     */
    async selectSkinTone(skinTone: SkinTone) {
        await expect(this.skinToneChoices).toBeVisible();
        await this.getSkinToneChoice(skinTone).click();
        await expect(this.skinToneChoices).not.toBeVisible();
        await this.verifySelectedSkinTone(skinTone);
    }

    /**
     * Verifies that the skin tone selector is collapsed with the given skin tone selected.
     */
    async verifySelectedSkinTone(skinTone: SkinTone) {
        await expect(this.getSelectedSkinTone(skinTone)).toBeVisible();
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
