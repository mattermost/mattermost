// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import RequiredAttributesForm from './required_attributes_form';

/**
 * The "Convert to Private Channel" dialog opened from a group message's header menu.
 */
export default class ConvertGmModal {
    readonly container: Locator;
    readonly nameInput: Locator;
    readonly confirmButton: Locator;
    readonly cancelButton: Locator;
    readonly attributes: RequiredAttributesForm;

    constructor(container: Locator) {
        this.container = container;
        this.nameInput = container.getByPlaceholder('Channel name', {exact: true});
        this.confirmButton = container.getByRole('button', {name: 'Convert to private channel', exact: true});
        this.cancelButton = container.getByRole('button', {name: 'Cancel', exact: true});
        this.attributes = new RequiredAttributesForm(container.getByTestId('channelAttributesForm'));
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async fillName(name: string) {
        await this.nameInput.fill(name);
    }

    async confirm() {
        await this.confirmButton.click();
        await expect(this.container).not.toBeVisible();
    }
}
