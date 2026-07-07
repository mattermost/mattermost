// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import {expect} from '@playwright/test';

export default class KeyboardShortcutsModal {
    readonly page: Page;
    readonly container;

    readonly heading;
    readonly closeButton;

    constructor(page: Page) {
        this.page = page;

        // The modal is exposed as a dialog whose accessible name begins with
        // "Keyboard shortcuts" followed by the Ctrl/Cmd + / sequence.
        this.container = page.getByRole('dialog', {name: /Keyboard shortcuts/i});
        this.heading = this.container.getByRole('heading', {name: /Keyboard shortcuts/i});
        this.closeButton = this.container.getByRole('button', {name: 'Close'});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await expect(this.heading).toBeVisible();
    }

    async notToBeVisible() {
        await expect(this.container).not.toBeVisible();
    }

    async closeWithButton() {
        await this.closeButton.click();
        await this.notToBeVisible();
    }

    async closeWithEscape() {
        await this.page.keyboard.press('Escape');
        await this.notToBeVisible();
    }
}
