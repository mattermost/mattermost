// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator, Page} from '@playwright/test';
import {expect} from '@playwright/test';

/**
 * System Console -> Reporting -> System Statistics
 */
export default class SiteStatistics {
    readonly page: Page;
    readonly container: Locator;
    readonly singleChannelGuests: Locator;
    readonly singleChannelGuestsTitle: Locator;
    readonly guestLimitBanner: Locator;

    constructor(adminConsoleWrapper: Locator, page: Page) {
        this.page = page;
        this.container = adminConsoleWrapper;
        this.singleChannelGuests = adminConsoleWrapper.getByTestId('singleChannelGuests');
        this.singleChannelGuestsTitle = adminConsoleWrapper.getByTestId('singleChannelGuestsTitle');
        this.guestLimitBanner = page.getByTestId('single_channel_guest_limit_banner');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async goto() {
        await this.page.goto('/admin_console/reporting/system_analytics');
        await this.page.waitForLoadState('networkidle');
    }

    async getSingleChannelGuestCount(): Promise<number> {
        const text = await this.singleChannelGuests.textContent();
        return Number(text?.match(/(\d+)/)?.[1] ?? 0);
    }

    async singleChannelGuestsTitleHasErrorStatus() {
        await expect(this.singleChannelGuestsTitle).toHaveAttribute('data-status', 'error');
    }

    async singleChannelGuestsTitleHasNoErrorStatus() {
        await expect(this.singleChannelGuestsTitle).not.toHaveAttribute('data-status', 'error');
    }
}
