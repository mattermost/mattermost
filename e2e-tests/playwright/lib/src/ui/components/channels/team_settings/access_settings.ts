// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

export default class AccessSettings {
    readonly container: Locator;

    readonly allowedDomainsCheckbox;
    readonly allowedDomainsInput;
    readonly allowOpenInviteCheckbox;
    readonly regenerateButton;

    constructor(container: Locator) {
        this.container = container;

        this.allowedDomainsCheckbox = container.locator('input[name="showAllowedDomains"]');
        this.allowedDomainsInput = container.locator('#allowedDomains input');
        this.allowOpenInviteCheckbox = container.locator('input[name="allowOpenInvite"]');
        this.regenerateButton = container.locator('button[data-testid="regenerateButton"]');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async enableAllowedDomains() {
        const isChecked = await this.allowedDomainsCheckbox.isChecked();
        if (!isChecked) {
            await this.allowedDomainsCheckbox.check();
        }
    }

    async addDomain(domain: string) {
        await expect(this.allowedDomainsInput).toBeVisible();
        await this.allowedDomainsInput.fill(domain);
        await this.allowedDomainsInput.press('Enter');
    }

    async removeDomain(domain: string) {
        const removeButton = this.container.locator(`div[role="button"][aria-label*="Remove ${domain}"]`);
        await expect(removeButton).toBeVisible();
        await removeButton.click();
    }

    async toggleOpenInvite() {
        await expect(this.allowOpenInviteCheckbox).toBeVisible();
        await this.allowOpenInviteCheckbox.click();
    }

    async regenerateInviteId() {
        await expect(this.regenerateButton).toBeVisible();
        await this.regenerateButton.click();
    }
}
