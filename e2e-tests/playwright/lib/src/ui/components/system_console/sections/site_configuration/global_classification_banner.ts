// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator, Page} from '@playwright/test';
import {expect} from '@playwright/test';

import en from '@/i18n';

/**
 * Page Object Model for the Global Classification Banner.
 *
 * Covers two distinct surfaces:
 *  1. The rendered banner elements that appear at the top / bottom of every page
 *     when the feature is enabled (bannerTop / bannerBottom).
 *  2. The admin console form controls that live inside the Classification Markings
 *     settings page and govern the banner's enabled state, classification level,
 *     and placement (enableToggle, levelSelector, visibilityToggle, saveButton).
 *
 * Pass the Playwright `Page` object so that both the top-of-page banner and the
 * full-page admin form controls can be located regardless of scroll position or
 * wrapper nesting.
 */
export default class GlobalClassificationBanner {
    readonly page: Page;

    // ── Rendered banner locators ──────────────────────────────────────────────
    /** The classification banner rendered at the top of the viewport. */
    readonly bannerTop: Locator;
    /** The classification banner rendered at the bottom of the viewport. */
    readonly bannerBottom: Locator;

    // ── Admin console form controls ───────────────────────────────────────────
    /**
     * Radio group that enables / disables the global banner.
     * True  → getByTestId('globalBannerEnabledtrue')
     * False → getByTestId('globalBannerEnabledfalse')
     */
    readonly enableToggle: {readonly true: Locator; readonly false: Locator};

    /**
     * Dropdown for selecting the classification level shown in the banner.
     * testId: 'globalBannerLevel'
     */
    readonly levelSelector: Locator;

    /**
     * Radio group that controls banner placement (visibility).
     * top          → getByTestId('globalBannerPlacementtrue')
     * topAndBottom → getByTestId('globalBannerPlacementfalse')
     */
    readonly visibilityToggle: {readonly top: Locator; readonly topAndBottom: Locator};

    /** Save button scoped to the admin console settings panel. */
    readonly saveButton: Locator;

    /** Inline error message rendered below a failing field. */
    readonly errorMessage: Locator;

    constructor(page: Page) {
        this.page = page;

        // Rendered banners are direct children of the root layout — locate from
        // the full page rather than a scoped container.
        this.bannerTop = page.getByTestId('global-classification-banner-top');
        this.bannerBottom = page.getByTestId('global-classification-banner-bottom');

        // Admin form controls share the same adminConsoleWrapper scope used by
        // the parent ClassificationMarkings POM.
        const adminWrapper = page.locator('#adminConsoleWrapper');

        this.enableToggle = {
            true: adminWrapper.getByTestId('globalBannerEnabledtrue'),
            false: adminWrapper.getByTestId('globalBannerEnabledfalse'),
        };

        this.levelSelector = adminWrapper.getByTestId('globalBannerLevel');

        this.visibilityToggle = {
            top: adminWrapper.getByTestId('globalBannerPlacementtrue'),
            topAndBottom: adminWrapper.getByTestId('globalBannerPlacementfalse'),
        };

        this.saveButton = adminWrapper.getByTestId('saveSetting');
        this.errorMessage = adminWrapper.getByTestId('errorMessage');
    }

    // ── Rendered-banner assertions ────────────────────────────────────────────

    /** Assert that the top banner is visible and contains the expected text. */
    async expectTopBannerVisible(text?: string): Promise<void> {
        await expect(this.bannerTop).toBeVisible();
        if (text !== undefined) {
            await expect(this.bannerTop).toContainText(text);
        }
    }

    /** Assert that the bottom banner is visible and contains the expected text. */
    async expectBottomBannerVisible(text?: string): Promise<void> {
        await expect(this.bannerBottom).toBeVisible();
        if (text !== undefined) {
            await expect(this.bannerBottom).toContainText(text);
        }
    }

    /** Assert that neither the top nor the bottom banner is visible. */
    async expectNoBannersVisible(): Promise<void> {
        await expect(this.bannerTop).not.toBeVisible();
        await expect(this.bannerBottom).not.toBeVisible();
    }

    // ── Admin form helpers ────────────────────────────────────────────────────

    /** Open the level dropdown and pick the option whose visible label matches levelLabel. */
    async selectLevel(levelLabel: string): Promise<void> {
        await this.levelSelector.click();
        const menu = this.page.getByRole('listbox');
        await expect(menu).toBeVisible();
        await menu.getByText(levelLabel, {exact: true}).click();
    }

    /** Click Save and wait for the button to become disabled (save complete). */
    async save(timeoutMs = 30_000): Promise<void> {
        await this.saveButton.click();
        await expect(this.saveButton).toBeDisabled({timeout: timeoutMs});
    }

    /**
     * Assert that the no-level-selected validation error is shown.
     * Uses the i18n key so the check is locale-independent.
     */
    async expectNoLevelError(): Promise<void> {
        await expect(
            this.page.getByText(en['admin.classification_markings.error.global_banner_no_level']),
        ).toBeVisible();
    }

    /**
     * Assert that the banner section heading is visible.
     * Useful as a quick sanity check that the right admin page is loaded.
     */
    async toBeVisible(): Promise<void> {
        await expect(
            this.page.getByText(en['admin.classification_markings.global_banner.section_title'], {exact: true}),
        ).toBeVisible();
    }
}
