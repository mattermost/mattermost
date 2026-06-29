// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';

/**
 * Access Rules tab panel inside ChannelSettingsModal.
 * Rendered at `.ChannelSettingsModal__accessRulesTab`.
 */
export default class AccessRulesSettings extends BaseComponent {
    readonly autoSyncMembersCheckbox: Locator;
    readonly systemPoliciesSection: Locator;
    readonly saveButton: Locator;

    constructor(container: Locator) {
        super(container);

        this.autoSyncMembersCheckbox = container.locator('#autoSyncMembersCheckbox');
        this.systemPoliciesSection = container.getByTestId('channelSystemPolicies');
        this.saveButton = container.getByTestId('SaveChangesPanel__save-btn');
    }

    getAllowedTabInConfirmModal(modal: Locator): Locator {
        return modal.getByTestId('confirmModalAllowedTab');
    }

    async toBeVisible(): Promise<void> {
        await expect(this.container).toBeVisible();
    }
}
