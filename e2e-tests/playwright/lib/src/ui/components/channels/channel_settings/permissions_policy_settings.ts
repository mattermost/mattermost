// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';

/**
 * Permissions Policy tab panel inside ChannelSettingsModal.
 * Rendered at `.ChannelSettingsModal__permissionsPolicyTab`.
 */
export default class PermissionsPolicySettings extends BaseComponent {
    async toBeVisible(): Promise<void> {
        await expect(this.container).toBeVisible();
    }
}
