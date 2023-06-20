// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Page} from '@playwright/test';

export default class LandingLoginPage {
    readonly page: Page;

    readonly isMobile?: boolean;

    readonly viewInAppButton;
    readonly viewInDesktopAppButton;
    readonly viewInBrowserButton;

    constructor(page: Page, isMobile?: boolean) {
        this.page = page;
        this.isMobile = isMobile;

        this.viewInAppButton = page.locator('text=View in App');
        this.viewInDesktopAppButton = page.locator('text=View in Desktop App');
        this.viewInBrowserButton = page.locator('text=View in Browser');
    }

    async toBeVisible() {
        await this.page.waitForLoadState('networkidle');

        if (this.isMobile) {
            await expect(this.viewInAppButton).toBeVisible();
        } else {
            await expect(this.viewInDesktopAppButton).toBeVisible();
        }

        await expect(this.viewInBrowserButton).toBeVisible();
    }

    async goto() {
        await this.page.goto('/landing#/login');
    }
}

export {LandingLoginPage};
