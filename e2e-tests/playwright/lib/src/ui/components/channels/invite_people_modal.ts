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

    async addEmail(email: string) {
        await expect(this.inviteInput).toBeVisible();
        await this.inviteInput.click();
        await this.inviteInput.pressSequentially(email, {delay: 50});

        const listbox = this.container.getByRole('listbox');
        await expect(listbox.getByRole('option').first()).toBeVisible({timeout: 15000});
        await this.inviteInput.press('Enter');

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
