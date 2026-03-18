// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

export default class InvitePeopleModal {
    readonly container: Locator;

    readonly closeButton: Locator;
    readonly inviteInput: Locator;
    readonly inviteButton: Locator;
    readonly copyInviteLinkButton: Locator;

    constructor(container: Locator) {
        this.container = container;

        this.closeButton = container.getByRole('button', {name: 'Close'});
        this.inviteInput = container.getByRole('combobox', {name: 'Invite People'});
        this.inviteButton = container.getByRole('button', {name: 'Invite', exact: true});
        this.copyInviteLinkButton = container.getByText('Copy invite link');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async close() {
        await this.closeButton.click();
    }

    /**
     * Types an email or username into the react-select invite input,
     * waits for a selectable option to load, selects it, then clicks the invite button.
     */
    async inviteByEmail(email: string) {
        await expect(this.inviteInput).toBeVisible();
        await this.inviteInput.click();
        await this.inviteInput.pressSequentially(email, {delay: 50});

        // Wait for react-select to finish loading and show a selectable option
        const listbox = this.container.getByRole('listbox');
        await expect(listbox.getByRole('option').first()).toBeVisible({timeout: 5000});
        await this.inviteInput.press('Enter');

        await expect(this.inviteButton).toBeEnabled();
        await this.inviteButton.click();
    }
}
