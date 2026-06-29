// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

export default class AutoTranslationPost extends BaseComponent {
    /** Badge/button shown on a post that has been auto-translated. */
    readonly translationBadge: Locator;

    /** Toggle button that switches a post back to its original (un-translated) text. */
    readonly originalTextToggle: Locator;

    /** Dropdown used to select the target display language for a translated post. */
    readonly languageSelectorDropdown: Locator;

    constructor(container: Locator) {
        super(container);

        this.translationBadge = container.getByRole('button', {
            name: en['post_info.translation_icon'],
        });

        this.originalTextToggle = container.getByRole('button', {
            name: en['post_info.translation_icon.hint'],
        });

        this.languageSelectorDropdown = container.getByRole('combobox', {
            name: en['post_info.translation_icon.title'],
        });
    }
}
