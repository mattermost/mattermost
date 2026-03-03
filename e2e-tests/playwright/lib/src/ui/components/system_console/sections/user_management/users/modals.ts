// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

import BaseModal from '@/ui/components/system_console/base_modal';

/**
 * Manage Roles modal (System Console -> Users -> Action -> Manage roles)
 */
export class ManageRolesModal extends BaseModal {
    readonly saveButton: Locator;

    constructor(container: Locator) {
        super(container);
        this.saveButton = container.getByRole('button', {name: 'Save'});
    }

    async save() {
        await this.saveButton.click();
        await expect(this.container).not.toBeVisible();
    }
}

/**
 * Reset Password modal (System Console -> Users -> Action -> Reset password)
 */
export class ResetPasswordModal extends BaseModal {
    readonly resetButton: Locator;
    readonly passwordInput: Locator;

    constructor(container: Locator) {
        super(container);
        this.resetButton = container.getByRole('button', {name: 'Reset'});
        this.passwordInput = container.locator('input[type="password"]');
    }

    async reset() {
        await this.resetButton.click();
        await expect(this.container).not.toBeVisible();
    }

    async fillPassword(password: string) {
        await this.passwordInput.fill(password);
    }
}

/**
 * Update Email modal (System Console -> Users -> Action -> Update email)
 */
export class UpdateEmailModal extends BaseModal {
    readonly updateButton: Locator;
    readonly emailInput: Locator;

    constructor(container: Locator) {
        super(container);
        this.updateButton = container.getByRole('button', {name: 'Update'});
        this.emailInput = container.locator('input[type="email"]');
    }

    async update() {
        await this.updateButton.click();
        await expect(this.container).not.toBeVisible();
    }

    async fillEmail(email: string) {
        await this.emailInput.fill(email);
    }
}
