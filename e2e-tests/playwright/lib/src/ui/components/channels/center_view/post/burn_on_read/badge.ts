// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';

export default class BurnOnReadBadge extends BaseComponent {
    readonly flameIcon: Locator;

    constructor(container: Locator) {
        super(container);
        this.flameIcon = container.getByTestId('burnOnReadBadgeIcon');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async toBeHidden() {
        await expect(this.container).not.toBeVisible();
    }

    async click() {
        await this.container.click();
    }

    async hover() {
        await this.container.hover();
    }

    /**
     * Get the tooltip/label text
     * Uses aria-label which contains the same information as the visible tooltip
     */
    async getTooltipText(): Promise<string> {
        // The aria-label contains the full tooltip information
        // e.g., "Click to delete message for everyone. Read by 1 of 2 recipients"
        const ariaLabel = await this.container.getAttribute('aria-label');
        if (ariaLabel) {
            return ariaLabel;
        }

        // Fallback: try to get text content
        return (await this.container.textContent()) || '';
    }

    /**
     * Get aria-label for accessibility testing
     */
    async getAriaLabel(): Promise<string> {
        return (await this.container.getAttribute('aria-label')) || '';
    }

    /**
     * Parse recipient count from tooltip
     * Returns {revealed: number, total: number}
     */
    async getRecipientCount(): Promise<{revealed: number; total: number}> {
        const tooltipText = await this.getTooltipText();
        const match = tooltipText.match(/Read by (\d+) of (\d+)/);

        if (!match) {
            throw new Error(`Could not parse recipient count from tooltip: ${tooltipText}`);
        }

        return {
            revealed: parseInt(match[1], 10),
            total: parseInt(match[2], 10),
        };
    }
}
