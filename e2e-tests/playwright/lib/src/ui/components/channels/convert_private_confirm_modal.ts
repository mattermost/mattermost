// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import RequiredAttributesForm from './required_attributes_form';

/**
 * The confirmation shown before a public channel becomes private, from Channel
 * Settings or the System Console channel page. It also asks for any required
 * attribute values the channel still lacks.
 */
export default class ConvertPrivateConfirmModal {
    readonly container: Locator;
    readonly confirmButton: Locator;
    readonly cancelButton: Locator;
    readonly attributes: RequiredAttributesForm;

    constructor(container: Locator) {
        this.container = container;
        this.confirmButton = container.locator('#confirmModalButton');
        this.cancelButton = container.getByRole('button', {name: 'No, cancel', exact: true});
        this.attributes = new RequiredAttributesForm(container.getByTestId('channelAttributesForm'));
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async confirm() {
        await this.confirmButton.click();
        await expect(this.container).not.toBeVisible();
    }
}
