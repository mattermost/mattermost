// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

export default class BurnOnReadTimerChip {
    readonly container: Locator;
    readonly flameIcon: Locator;
    readonly timerText: Locator;

    constructor(container: Locator) {
        this.container = container;
        this.flameIcon = container.locator('.BurnOnReadTimerChip__icon');
        this.timerText = container.locator('.BurnOnReadTimerChip__time');
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
     * Get the displayed time remaining (e.g., "0:45", "1:30")
     */
    async getTimeRemaining(): Promise<string> {
        return (await this.timerText.textContent()) || '';
    }

    /**
     * Parse time remaining into seconds
     */
    async getTimeRemainingInSeconds(): Promise<number> {
        const timeText = await this.getTimeRemaining();
        const parts = timeText.split(':');
        
        if (parts.length !== 2) {
            throw new Error(`Invalid timer format: ${timeText}`);
        }

        const minutes = parseInt(parts[0], 10);
        const seconds = parseInt(parts[1], 10);
        return minutes * 60 + seconds;
    }

    /**
     * Check if timer is in warning state (last 30 seconds)
     */
    async isWarning(): Promise<boolean> {
        const className = await this.container.getAttribute('class');
        return className?.includes('BurnOnReadTimerChip--warning') || false;
    }

    /**
     * Check if timer has expired
     */
    async isExpired(): Promise<boolean> {
        const className = await this.container.getAttribute('class');
        return className?.includes('BurnOnReadTimerChip--expired') || false;
    }

    /**
     * Get tooltip text
     */
    async getTooltipText(): Promise<string> {
        await this.hover();
        
        // Wait for tooltip to appear
        const tooltip = this.container.page().locator('[role="tooltip"]').first();
        await tooltip.waitFor({state: 'visible', timeout: 2000});
        return (await tooltip.textContent()) || '';
    }
}

