// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export default class ThreadFooter {
    readonly container: Locator;

    readonly replyButton: Locator;
    readonly avatarImages: Locator;

    constructor(container: Locator) {
        this.container = container;

        this.replyButton = container.getByTestId('thread-footer-reply-button');
        this.avatarImages = container.locator('img.Avatar');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async toHaveNReplies(n: number) {
        const text = n === 1 ? '1 reply' : `${n} replies`;

        await expect(this.replyButton).toContainText(text);
    }

    /**
     * True if every avatar in the footer has loaded a real image (not broken/blank).
     */
    async hasLoadedAvatars(): Promise<boolean> {
        await expect(this.avatarImages.first()).toBeVisible();
        const count = await this.avatarImages.count();
        for (let i = 0; i < count; i++) {
            const loaded = await this.avatarImages
                .nth(i)
                .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
            if (!loaded) {
                return false;
            }
        }
        return true;
    }

    /**
     * Clicks on the reply button in the thread footer to open the thread in RHS.
     */
    async reply() {
        await this.replyButton.waitFor();
        await this.replyButton.click();
    }
}
