// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export default class ThreadFooter {
    readonly container: Locator;

    readonly replyButton: Locator;

    readonly avatars: Locator;

    readonly overflowChip: Locator;

    readonly overflowPopover: Locator;

    constructor(container: Locator) {
        this.container = container;

        this.replyButton = container.getByTestId('thread-footer-reply-button');
        this.avatars = container.locator('.Avatars');

        // Core renders the "+N" chip as a plain Avatar, distinguishing it from the
        // participant images by the absence of a src.
        this.overflowChip = this.avatars.locator('.Avatar-plain');
        this.overflowPopover = container.page().getByTestId('avatars-overflow-popover');
    }

    /**
     * Opens the "+N" overflow list. Requires the Avatars instance to have opted in
     * via showOverflowPopover.
     */
    async openOverflow() {
        await this.overflowChip.click();
        await expect(this.overflowPopover).toBeVisible();
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async toHaveNReplies(n: number) {
        const text = n === 1 ? '1 reply' : `${n} replies`;

        await expect(this.replyButton).toContainText(text);
    }

    /**
     * Clicks on the reply button in the thread footer to open the thread in RHS.
     */
    async reply() {
        await this.replyButton.waitFor();
        await this.replyButton.click();
    }
}
