// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';

import PersonalAccessTokensSection from './personal_access_tokens_section';

export default class SecuritySettings extends BaseComponent {
    readonly personalAccessTokensSection: PersonalAccessTokensSection;

    constructor(container: Locator) {
        super(container);

        this.personalAccessTokensSection = new PersonalAccessTokensSection(container);
    }

    async toBeVisible(): Promise<void> {
        await expect(this.container).toBeVisible();
    }
}
