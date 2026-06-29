// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';

/**
 * "Test Access Rule" results dialog in System Console > Access Control.
 * Rendered at page level via a portal.
 */
export default class AccessControlTestResultsModal extends BaseComponent {
    readonly memberCountText: Locator;
    readonly userButtons: Locator;
    readonly searchInput: Locator;
    readonly closeButton: Locator;

    constructor(container: Locator) {
        super(container);

        this.memberCountText = container.locator('text=/\\d+.*(members|total|match)/i');
        this.userButtons = container.locator('[class*="more-modal__name"] button');
        this.searchInput = container.locator('input[placeholder*="Search" i]').first();
        this.closeButton = container.locator('button[aria-label*="Close" i], .close, button:has-text("×")').first();
    }

    getUserByUsername(username: string): Locator {
        return this.container.locator(`text=@${username}`).first();
    }

    async toBeVisible(): Promise<void> {
        await expect(this.container).toBeVisible();
    }

    async close(): Promise<void> {
        await this.closeButton.click();
    }
}
