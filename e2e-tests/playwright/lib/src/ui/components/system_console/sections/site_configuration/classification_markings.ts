// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

export default class ClassificationMarkings extends BaseComponent {
    readonly classificationEnabledTrue: Locator;
    readonly classificationEnabledFalse: Locator;
    readonly globalBannerEnabledTrue: Locator;
    readonly globalBannerEnabledFalse: Locator;
    readonly globalBannerPlacementTop: Locator;
    readonly globalBannerPlacementTopAndBottom: Locator;
    readonly globalBannerPlacement: Locator;
    readonly classificationPresetDropdown: Locator;
    readonly globalBannerLevelDropdown: Locator;
    readonly errorMessage: Locator;
    readonly saveButton: Locator;

    constructor(container: Locator) {
        super(container);

        this.classificationEnabledTrue = container.getByTestId('classificationEnabledtrue');
        this.classificationEnabledFalse = container.getByTestId('classificationEnabledfalse');
        this.globalBannerEnabledTrue = container.getByTestId('globalBannerEnabledtrue');
        this.globalBannerEnabledFalse = container.getByTestId('globalBannerEnabledfalse');
        this.globalBannerPlacementTop = container.getByTestId('globalBannerPlacementtrue');
        this.globalBannerPlacementTopAndBottom = container.getByTestId('globalBannerPlacementfalse');
        this.globalBannerPlacement = container.getByTestId('globalBannerPlacementtrue');
        this.classificationPresetDropdown = container.getByTestId('classificationPreset');
        this.globalBannerLevelDropdown = container.getByTestId('globalBannerLevel');
        this.errorMessage = container.getByTestId('errorMessage');
        this.saveButton = container.page().getByTestId('saveSetting');
    }

    levelNameInput(nth: number): Locator {
        return this.container.page().getByLabel(en['admin.classification_markings.levels.table.text.input']).nth(nth);
    }

    deleteLevelButton(nth: number): Locator {
        return this.container
            .page()
            .getByRole('button', {name: en['admin.classification_markings.levels.table.delete']})
            .nth(nth);
    }

    get presetChangeConfirmModal(): Locator {
        return this.container.page().getByText(en['admin.classification_markings.preset_switch.title']);
    }

    get changePresetButton(): Locator {
        return this.container
            .page()
            .getByRole('button', {name: en['admin.classification_markings.preset_switch.confirm']});
    }

    get validationError(): Locator {
        return this.container.page().getByText(en['admin.classification_markings.error.no_levels']);
    }

    get presetsDropdown(): Locator {
        return this.classificationPresetDropdown;
    }

    getOpenDropdownMenu(): Locator {
        return this.container.page().getByRole('listbox');
    }

    async selectPreset(optionLabel: string): Promise<void> {
        await this.classificationPresetDropdown.click();
        const menu = this.getOpenDropdownMenu();
        await expect(menu).toBeVisible();
        await menu.getByText(optionLabel, {exact: true}).click();
    }

    async selectGlobalBannerLevel(levelLabel: string): Promise<void> {
        await this.globalBannerLevelDropdown.click();
        const menu = this.getOpenDropdownMenu();
        await expect(menu).toBeVisible();
        await menu.getByText(levelLabel, {exact: true}).click();
    }

    async toBeVisible(): Promise<void> {
        await expect(this.container).toBeVisible();
    }
}
