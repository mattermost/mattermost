// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

/**
 * System Console -> Site Configuration -> Localization -> Auto-translation section.
 *
 * Covers the toggle that enables auto-translation system-wide and the
 * multi-select used to choose which target languages are available.
 */
export default class AutoTranslationSystemConsoleSection extends BaseComponent {
    /** The on/off toggle button for the auto-translation feature. */
    readonly enableToggle: Locator;

    /** Multi-select widget for choosing target translation languages. */
    readonly languageSelect: Locator;

    /** Save button for the enclosing settings page. */
    readonly saveButton: Locator;

    constructor(container: Locator) {
        super(container);

        this.enableToggle = container.getByTestId('autoTranslationSectionToggle').locator('button');

        this.languageSelect = container.getByTestId('TargetLanguages');

        this.saveButton = container.getByRole('button', {name: en['save_button.save']});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    /** Returns true when the enable toggle is currently on (aria-checked="true"). */
    async isEnabled(): Promise<boolean> {
        await this.enableToggle.waitFor({state: 'visible'});
        const ariaChecked = await this.enableToggle.getAttribute('aria-checked');
        return ariaChecked === 'true';
    }

    /** Turns the enable toggle on if it is not already on. */
    async enable() {
        const on = await this.isEnabled();
        if (!on) {
            await this.enableToggle.click();
        }
    }

    /** Turns the enable toggle off if it is not already off. */
    async disable() {
        const on = await this.isEnabled();
        if (on) {
            await this.enableToggle.click();
        }
    }

    async save() {
        await this.saveButton.click();
    }
}
