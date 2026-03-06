// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

export default class CreateTeamForm {
    readonly container: Locator;

    // Display name step
    readonly teamNameInput: Locator;
    readonly teamNameNextButton: Locator;
    readonly teamNameError: Locator;

    // Team URL step
    readonly teamURLInput: Locator;
    readonly teamURLFinishButton: Locator;
    readonly teamURLError: Locator;
    readonly backLink: Locator;

    constructor(container: Locator) {
        this.container = container;

        this.teamNameInput = container.locator('#teamNameInput');
        this.teamNameNextButton = container.locator('#teamNameNextButton');
        this.teamNameError = container.locator('#teamNameInputError');

        this.teamURLInput = container.locator('#teamURLInput');
        this.teamURLFinishButton = container.locator('#teamURLFinishButton');
        this.teamURLError = container.locator('#teamURLInputError');
        this.backLink = container.getByText('Back to previous step');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async fillTeamName(name: string) {
        await this.teamNameInput.fill(name);
    }

    async submitDisplayName() {
        await this.teamNameNextButton.click();
    }

    async fillTeamURL(url: string) {
        await this.teamURLInput.fill(url);
    }

    async submitTeamURL() {
        await this.teamURLFinishButton.click();
    }

    async goBack() {
        await this.backLink.click();
    }
}
