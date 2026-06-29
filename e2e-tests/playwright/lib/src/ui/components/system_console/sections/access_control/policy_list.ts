// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

export default class PolicyList extends BaseComponent {
    readonly searchInput: Locator;
    readonly policyRows: Locator;
    readonly dataGridRows: Locator;

    constructor(container: Locator) {
        super(container);

        this.searchInput = this.container.getByPlaceholder(en['search_bar.search']);
        this.policyRows = this.container.getByTestId('policyName');
        this.dataGridRows = this.container.getByTestId('dataGridRow');
    }

    getPolicyRowByName(name: string): Locator {
        return this.container.getByTestId('policyName').filter({hasText: name});
    }

    async searchPolicy(name: string): Promise<void> {
        await this.searchInput.fill(name);
    }

    getPolicyMenuButton(row: Locator): Locator {
        return row.getByRole('button', {name: en['admin.access_control.policies.menu.aria_label']}).first();
    }

    getEditMenuItem(policyId: string): Locator {
        return this.container.page().locator(`[id*="policy-menu-edit-${policyId}"]`);
    }

    getPolicyRowByText(text: string): Locator {
        return this.container.getByTestId('dataGridRow').filter({hasText: text}).first();
    }

    get createPolicyButton(): Locator {
        return this.container.getByRole('button', {name: en['admin.access_control.policies.add_policy']});
    }

    get deleteConfirmModal(): Locator {
        return this.container.page().getByRole('dialog');
    }

    async toBeVisible(): Promise<void> {
        await expect(this.container).toBeVisible();
    }
}
