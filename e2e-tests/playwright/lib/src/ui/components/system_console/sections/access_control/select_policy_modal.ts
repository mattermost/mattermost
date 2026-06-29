// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';

/**
 * "Select a Membership Policy" modal in System Console > Access Control.
 * Used when linking a channel or team to an existing policy.
 */
export default class SelectMembershipPolicyModal extends BaseComponent {
    readonly searchInput: Locator;
    readonly policyRows: Locator;
    readonly closeButton: Locator;

    constructor(container: Locator) {
        super(container);

        this.searchInput = container.getByTestId('searchInput');
        this.policyRows = container.getByTestId('dataGridRow');
        this.closeButton = container.locator('button[aria-label*="Close" i]').first();
    }

    getPolicyRowByName(name: string): Locator {
        return this.container.getByTestId('dataGridRow').filter({hasText: name}).first();
    }

    async toBeVisible(): Promise<void> {
        await expect(this.container).toBeVisible();
    }
}
