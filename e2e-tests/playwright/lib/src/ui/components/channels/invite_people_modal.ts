// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

export default class InvitePeopleModal extends BaseComponent {
    readonly closeButton: Locator;
    readonly inviteInput: Locator;
    readonly inviteButton: Locator;
    readonly copyInviteLinkButton: Locator;
    readonly title: Locator;
    readonly saveButton: Locator;
    readonly autocompleteListbox: Locator;

    constructor(container: Locator) {
        super(container);

        this.closeButton = container.getByRole('button', {name: en['generic.close']});
        this.inviteInput = container.getByRole('combobox', {name: en['invitation_modal.members.search_and_add.title']});
        this.inviteButton = container.getByRole('button', {name: en['invite_modal.invite'], exact: true});
        this.copyInviteLinkButton = container.getByTestId('InviteView__copyInviteLink');
        this.title = container.locator('#invitation_modal_title');
        this.saveButton = container.locator('#saveItems');
        this.autocompleteListbox = container.getByRole('listbox');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async close() {
        await this.closeButton.click();
    }

    getOptionByUsername(username: string): Locator {
        return this.autocompleteListbox.getByRole('option', {name: username});
    }

    /**
     * Types an email or username into the react-select invite input,
     * waits for a selectable option to load, selects it, then clicks the invite button.
     */
    async inviteByEmail(email: string) {
        await expect(this.inviteInput).toBeVisible();
        await this.inviteInput.click();
        await this.inviteInput.pressSequentially(email, {delay: 50});

        // Wait for react-select to finish loading and show a selectable option.
        // Use a longer timeout (15 s) to tolerate slow email-validation responses in CI.
        const listbox = this.container.getByRole('listbox');
        await expect(listbox.getByRole('option').first()).toBeVisible({timeout: 15000});
        await this.inviteInput.press('Enter');

        await expect(this.inviteButton).toBeEnabled();
        await this.inviteButton.click();
    }
}
