// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

export default class UserProfilePopover extends BaseComponent {
    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async close() {
        await this.container.getByLabel(en['user_profile.close']).click();
    }

    getCustomAttributeTitle(fieldId: string): Locator {
        return this.container.locator(`#user-popover__custom_attributes-title-${fieldId}`);
    }

    customAttributeByName(name: string): Locator {
        return this.container.getByTestId('customProfileAttributeValue').filter({hasText: name});
    }

    get phoneLink(): Locator {
        return this.container.locator('a[href^="tel:"]');
    }

    get urlLink(): Locator {
        return this.container.locator('a[href^="http"]');
    }
}
