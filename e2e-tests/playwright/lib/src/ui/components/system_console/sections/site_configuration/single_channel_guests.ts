// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

import {RadioSetting} from '../../base_components';

/**
 * System Console -> Site Configuration -> Guest Access (Single-channel Guests)
 */
export default class SingleChannelGuests extends BaseComponent {
    readonly header: Locator;
    readonly enableToggle: RadioSetting;
    readonly saveButton: Locator;

    constructor(container: Locator) {
        super(container);

        this.header = container.getByText(en['admin.authentication.guest_access'], {exact: true});
        this.enableToggle = new RadioSetting(container.getByTestId('GuestAccountsSettings.Enable'));
        this.saveButton = container.getByRole('button', {name: en['save_button.save']});
    }

    /**
     * The confirmation modal shown when disabling guest access.
     * Rendered by ConfirmModal with default id "confirmModal".
     */
    get confirmModal(): Locator {
        return this.container.page().getByTestId('confirmModal');
    }

    /**
     * Confirm button inside the disable-guest-access confirmation modal.
     */
    get confirmModalConfirmButton(): Locator {
        return this.container.page().getByRole('button', {name: en['admin.guest_access.disableConfirmButton']});
    }

    /**
     * Cancel button inside the disable-guest-access confirmation modal.
     */
    get confirmModalCancelButton(): Locator {
        return this.container.page().getByTestId('cancel-button');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await expect(this.header).toBeVisible();
    }

    async save() {
        await this.saveButton.click();
    }
}
