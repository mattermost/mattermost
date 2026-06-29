// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

export default class ShowTranslationModal extends BaseComponent {
    readonly originalLabel: Locator;
    readonly autoTranslatedLabel: Locator;
    readonly closeButton: Locator;

    constructor(container: Locator) {
        super(container);
        this.originalLabel = container.getByText(en['show_translation.original_badge']);
        this.autoTranslatedLabel = container.getByText(en['show_translation.auto_translated_badge']);
        this.closeButton = container.getByRole('button', {name: en['generic.close']});
    }

    async toBeVisible(): Promise<void> {
        await expect(this.container).toBeVisible();
    }
}
