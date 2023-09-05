// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

export default class EmojiGifPicker {
    readonly container: Locator;

    readonly gifTab: Locator;
    readonly gifInput: Locator;
    readonly gifPlane: Locator;

    constructor(container: Locator) {
        this.container = container;

        this.gifTab = container.getByText('GIFs');
        this.gifInput = container.getByPlaceholder('Search GIPHY');
        this.gifPlane = container.locator('.gif-picker__items')
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async openGifTab() {
        await expect(this.gifTab).toBeVisible();
        
        await this.gifTab.click({force: true});

        await expect(this.gifInput).toBeVisible();
        await expect(this.gifPlane).toBeVisible();
    }

    async searchGif(name: string) {
        await this.gifInput.fill(name);
        await expect(this.gifInput).toHaveValue(name);
    }

    async getNthGif(n: number) {
        await expect(this.gifPlane).toBeVisible();

        await this.gifPlane.locator('img').nth(n).waitFor();
        const nthGif = this.gifPlane.locator('img').nth(n);
        await expect(nthGif).toBeVisible()

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

export {EmojiGifPicker};
