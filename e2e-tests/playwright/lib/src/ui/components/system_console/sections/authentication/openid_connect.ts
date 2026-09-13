// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

/**
 * System Console -> Authentication -> OpenID Connect
 */
export default class OpenIdConnect {
    readonly container: Locator;

    readonly serviceProvider: Locator;
    readonly buttonName: Locator;
    readonly buttonColor: Locator;
    readonly discoveryEndpoint: Locator;
    readonly clientId: Locator;
    readonly clientSecret: Locator;
    readonly gitlabSiteUrl: Locator;
    readonly directoryId: Locator;
    readonly saveButton: Locator;

    constructor(container: Locator) {
        this.container = container;

        this.serviceProvider = container.getByRole('combobox', {name: 'Select service provider:'});
        this.buttonName = container.getByRole('textbox', {name: 'Button Name:'});
        this.buttonColor = container.getByTestId('OpenIdSettings.ButtonColor').getByTestId('color-inputColorValue');
        this.discoveryEndpoint = container.getByRole('textbox', {name: 'Discovery Endpoint:'});
        this.clientId = container.getByRole('textbox', {name: 'Client ID:'});
        this.clientSecret = container.getByRole('textbox', {name: 'Client Secret:'});
        this.gitlabSiteUrl = container.getByRole('textbox', {name: 'GitLab Site URL:'});
        this.directoryId = container.getByRole('textbox', {name: 'Directory (tenant) ID:'});
        this.saveButton = container.getByRole('button', {name: 'Save'});
    }

    async toBeVisible() {
        await expect(this.serviceProvider).toBeVisible();
    }

    async selectProvider(value: 'off' | 'openid' | 'google' | 'gitlab' | 'office365') {
        await this.serviceProvider.selectOption(value);
    }

    async fillButtonColor(hex: string) {
        // ColorInput.onFocus selects past the leading '#', so a normal fill would
        // produce "##c02222" and the widget would revert on blur.
        await this.buttonColor.click({clickCount: 3});
        await this.buttonColor.fill(hex);
        await this.buttonColor.blur();
    }

    async save() {
        await expect(this.saveButton).toBeEnabled();
        await this.saveButton.click();
        await expect(this.saveButton).toBeDisabled();
    }
}
