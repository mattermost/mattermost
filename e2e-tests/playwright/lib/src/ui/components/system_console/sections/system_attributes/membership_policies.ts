// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator, Page} from '@playwright/test';
import {expect} from '@playwright/test';

import {duration} from '@/util';

const MEMBERSHIP_POLICIES_URL = '/admin_console/system_attributes/membership_policies';

/**
 * System Console -> System Attributes -> Membership Policies
 *
 * Covers the policy list and the simple-mode table editor (attribute / operator / value).
 */
export default class MembershipPolicies {
    readonly page: Page;

    readonly addPolicyButton: Locator;
    readonly searchInput: Locator;
    readonly policyNameInput: Locator;
    readonly addAttributeButton: Locator;
    readonly attributeSelectorButton: Locator;
    readonly attributeSelectorMenu: Locator;
    readonly operatorSelectorButton: Locator;
    readonly valueSelectorButton: Locator;
    readonly saveButton: Locator;
    readonly switchToSimpleModeButton: Locator;

    constructor(page: Page) {
        this.page = page;

        this.addPolicyButton = page.getByRole('button', {name: 'Add policy'});
        this.searchInput = page.getByRole('textbox', {name: 'Search'});
        this.policyNameInput = page.getByLabel('Membership policy name:');
        this.addAttributeButton = page.getByRole('button', {name: /add attribute/i});
        this.attributeSelectorButton = page.getByTestId('attributeSelectorMenuButton').first();
        this.attributeSelectorMenu = page.getByRole('menu', {name: 'Select attribute'});
        this.operatorSelectorButton = page.getByTestId('operatorSelectorMenuButton').first();
        this.valueSelectorButton = page.getByTestId('valueSelectorMenuButton').first();
        this.saveButton = page.getByRole('button', {name: 'Save'}).last();
        this.switchToSimpleModeButton = page.getByRole('button', {name: 'Switch to Simple Mode'});
    }

    async goto() {
        await this.page.goto(MEMBERSHIP_POLICIES_URL);
        await this.page.waitForLoadState('networkidle');
    }

    policyName(name: string): Locator {
        return this.page.getByTestId('policyName').filter({hasText: name}).first();
    }

    /** Search the policy list (paginated) and open the matching policy. Returns its id. */
    async openPolicy(name: string): Promise<string | null> {
        await this.searchInput.fill(name);
        const row = this.policyName(name);
        await expect(row).toBeVisible();
        const rowId = await row.getAttribute('id');
        await row.click();
        await this.page.waitForLoadState('networkidle');
        return rowId?.replace('customDescription-', '') ?? null;
    }

    attributeOption(name: string): Locator {
        return this.attributeSelectorMenu.getByRole('menuitemradio', {name: new RegExp(name)}).first();
    }

    menuItemRadio(label: string): Locator {
        return this.page.getByRole('menuitemradio', {name: label, exact: true});
    }

    async openNewPolicy() {
        await this.addPolicyButton.click();
        await this.page.waitForLoadState('networkidle');
        await expect(this.policyNameInput).toBeVisible();
    }

    /**
     * Attributes load async after opening the editor. If "Add attribute" is still
     * disabled, reload once and wait for the default expect timeout.
     */
    async ensureAddAttributeEnabled(policyName: string) {
        await expect(this.addAttributeButton).toBeVisible();
        if (await this.addAttributeButton.isDisabled()) {
            await this.page.reload();
            await this.page.waitForLoadState('networkidle');
            await this.policyNameInput.fill(policyName);
            await expect(this.addAttributeButton).toBeEnabled();
        }
    }

    async selectAttribute(name: string) {
        if (!(await this.attributeSelectorMenu.isVisible({timeout: duration.two_sec}).catch(() => false))) {
            await this.attributeSelectorButton.click();
        }
        const option = this.attributeOption(name);
        await expect(option).toBeVisible();
        await option.click();
        await expect(this.attributeSelectorMenu).toBeHidden();
        await expect(this.attributeSelectorButton).toContainText(name);
    }
}
