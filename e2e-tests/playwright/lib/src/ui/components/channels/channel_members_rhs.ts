// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';

/**
 * Channel Members right-hand sidebar panel.
 * Shown when clicking the Members icon in the channel header.
 */
export default class ChannelMembersRhs extends BaseComponent {
    readonly policyEnforcedAlert: Locator;

    constructor(container: Locator) {
        super(container);

        this.policyEnforcedAlert = container.getByTestId('channelMembersRhsPolicyAlert');
    }

    getMemberDisplayName(memberEntry: Locator): Locator {
        return memberEntry.getByTestId('channelMembersDisplayName');
    }

    async toBeVisible(): Promise<void> {
        await expect(this.container).toBeVisible();
    }
}
