// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import {expect} from '@playwright/test';

import {BasePage} from '../base_page';
import type {BaseComponent} from '../base_component';

export default class LandingLoginPage extends BasePage {
    readonly components: Record<string, BaseComponent>;

    readonly isMobile?: boolean;

    readonly viewInAppButton;
    readonly viewInDesktopAppButton;
    readonly viewInBrowserButton;

    constructor(page: Page, isMobile?: boolean) {
        super(page);
        this.isMobile = isMobile;

        this.viewInAppButton = page.locator('text=View in App');
        this.viewInDesktopAppButton = page.locator('text=View in Desktop App');
        this.viewInBrowserButton = page.locator('text=View in Browser');

        this.components = {};
    }

    async toBeVisible() {
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
