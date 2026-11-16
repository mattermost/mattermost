// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

/**
 * System Console -> Authentication -> MFA
 */
export default class MfaSettings {
    readonly container: Locator;

    readonly header: Locator;
    readonly enableTrue: Locator;
    readonly enableFalse: Locator;
    readonly enforceTrue: Locator;
    readonly enforceFalse: Locator;
    readonly saveButton: Locator;

    constructor(container: Locator) {
        this.container = container;
        this.header = container.getByText('Multi-factor Authentication', {exact: true});
        this.enableTrue = container.getByTestId('ServiceSettings.EnableMultifactorAuthenticationtrue');
        this.enableFalse = container.getByTestId('ServiceSettings.EnableMultifactorAuthenticationfalse');
        this.enforceTrue = container.getByTestId('ServiceSettings.EnforceMultifactorAuthenticationtrue');
        this.enforceFalse = container.getByTestId('ServiceSettings.EnforceMultifactorAuthenticationfalse');
        this.saveButton = container.getByRole('button', {name: 'Save'});
    }

    async toBeVisible() {
        await expect(this.header).toBeVisible();
    }

    async save() {
        await expect(this.saveButton).toBeEnabled();
        await this.saveButton.click();
        await expect(this.saveButton).toBeDisabled();
    }
}
