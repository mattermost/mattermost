// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import Switch from '@/ui/components/switch';

/**
 * System Console -> User Management -> Channels -> Channel Configuration
 * Accessed by clicking Edit on a channel row in the Channels list
 */
export default class ChannelDetail {
    readonly container: Locator;

    readonly policyEnforceSwitch: Switch;

    constructor(container: Locator) {
        this.container = container;

        this.policyEnforceSwitch = new Switch(container, 'policy-enforce-toggle-button');
    }

    async enablePolicyEnforcement() {
        await expect(this.policyEnforceSwitch.input).toBeVisible();
        if (!(await this.policyEnforceSwitch.isChecked())) {
            await this.policyEnforceSwitch.check();
        }
    }
}
