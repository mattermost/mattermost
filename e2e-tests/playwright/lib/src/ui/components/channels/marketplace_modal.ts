// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {duration} from '@/util';

export default class MarketplaceModal {
    readonly container: Locator;

    readonly closeButton;

    constructor(container: Locator) {
        this.container = container;

        this.closeButton = container.getByRole('button', {name: 'Close'});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async notToBeVisible() {
        await expect(this.container).not.toBeVisible();
    }

    async close() {
        await this.closeButton.click();
    }

    /**
     * Locates a plugin's row by its manifest id (e.g. "com.mattermost.plugin-channel-export").
     * Uses an attribute-equals selector rather than a `#id` locator since manifest ids contain
     * dots, which have special meaning in compound CSS id selectors.
     */
    pluginRow(pluginId: string): Locator {
        return this.container.locator(`[id="marketplace-plugin-${pluginId}"]`);
    }

    /**
     * Installs the first plugin in the list that isn't already installed (i.e. still shows an
     * "Install" button, as opposed to "Configure"), and waits for its button to flip to
     * "Configure". Returns the installed plugin's manifest id.
     */
    async installFirstAvailablePlugin(): Promise<string> {
        const installButton = this.container.getByRole('button', {name: 'Install', exact: true}).first();
        await expect(installButton).toBeVisible();

        const pluginId = await installButton.evaluate((el) => {
            const row = el.closest('[id^="marketplace-plugin-"]');
            return row ? row.id.replace('marketplace-plugin-', '') : null;
        });
        if (!pluginId) {
            throw new Error('Could not determine the plugin id for the first available "Install" button');
        }

        await installButton.click();
        await expect(this.pluginRow(pluginId).getByRole('button', {name: 'Configure'})).toBeVisible({
            timeout: duration.one_min,
        });

        return pluginId;
    }

    /**
     * Clicks "Configure" for the given plugin, which navigates to its System Console settings page.
     */
    async clickConfigure(pluginId: string) {
        await this.pluginRow(pluginId).getByRole('button', {name: 'Configure'}).click();
    }
}
