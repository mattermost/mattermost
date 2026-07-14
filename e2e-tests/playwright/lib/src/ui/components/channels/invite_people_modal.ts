// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export default class InvitePeopleModal {
    readonly container: Locator;

    readonly closeButton: Locator;
    readonly inviteInput: Locator;
    readonly inviteButton: Locator;
    readonly copyInviteLinkButton: Locator;
    readonly profileInputs: Locator;

    constructor(container: Locator) {
        this.container = container;

        this.closeButton = container.getByRole('button', {name: 'Close'});
        this.inviteInput = container.getByRole('combobox', {name: 'Invite People'});
        this.inviteButton = container.getByRole('button', {name: 'Invite', exact: true});
        this.copyInviteLinkButton = container.getByText('Copy invite link');
        this.profileInputs = container.getByTestId('MemberProfileInputs');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async close() {
        await this.closeButton.click();
    }

    /**
     * Types an email or username into the react-select invite input,
     * waits for a selectable option to load, and selects it.
     */
    async addEmail(email: string) {
        await expect(this.inviteInput).toBeVisible();
        await this.inviteInput.click();
        await this.inviteInput.pressSequentially(email, {delay: 50});

        // Wait for react-select to finish loading and show a selectable option.
        // Use a longer timeout (15 s) to tolerate slow email-validation responses in CI.
        const listbox = this.container.getByRole('listbox');
        await expect(listbox.getByRole('option').first()).toBeVisible({timeout: 15000});
        await this.inviteInput.press('Enter');

        // React-select clears the input only once the selection is taken. The selected
        // chip may show the raw email or, for an existing user, their display name, so
        // the cleared input is the reliable signal that the entry was added.
        await expect(this.inviteInput).toHaveValue('');
    }

    async submitInvites() {
        await expect(this.inviteButton).toBeEnabled();
        await this.inviteButton.click();
    }

    async inviteByEmail(email: string) {
        await this.addEmail(email);
        await this.submitInvites();
    }

    getProfileRow(email: string) {
        const row = this.container.getByTestId(`MemberProfileInputs__row-${email.toLowerCase()}`);
        return {
            container: row,
            firstNameInput: row.getByRole('textbox', {name: 'First name'}),
            lastNameInput: row.getByRole('textbox', {name: 'Last name'}),
            usernameInput: row.getByRole('textbox', {name: 'Username'}),
        };
    }
}
