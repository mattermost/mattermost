// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import RequiredAttributesForm from './required_attributes_form';

/**
 * The Unarchive Channel confirmation modal. It asks for the required channel
 * attribute values the channel lacks and the person can set ("Set and
 * unarchive"), or shows a notice when only a channel admin can set them.
 */
export default class UnarchiveChannelModal {
    readonly container: Locator;
    readonly requiredAttributes: Locator;
    readonly flaggedNotice: Locator;
    readonly attributes: RequiredAttributesForm;
    readonly cancelButton: Locator;
    readonly confirmButton: Locator;

    constructor(container: Locator) {
        this.container = container;
        this.requiredAttributes = container.getByTestId('unarchiveChannelModalRequiredAttributes');
        this.flaggedNotice = container.getByTestId('unarchiveChannelModalFlaggedNotice');
        this.attributes = new RequiredAttributesForm(this.requiredAttributes);
        this.cancelButton = container.getByRole('button', {name: 'Cancel', exact: true});
        this.confirmButton = container.getByRole('button', {name: /^(Unarchive|Set and unarchive)$/});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async confirm() {
        await this.confirmButton.click();
        await expect(this.container).not.toBeVisible();
    }

    async cancel() {
        await this.cancelButton.click();
        await expect(this.container).not.toBeVisible();
    }
}
