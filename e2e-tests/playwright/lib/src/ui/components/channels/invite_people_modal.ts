// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {duration} from '@/util';

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
        this.copyInviteLinkButton = container.getByRole('button', {name: /^team invite link /});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async close() {
        await this.closeButton.click();
    }

    async copyInviteLink() {
        await expect(this.copyInviteLinkButton).toBeVisible();
        await this.copyInviteLinkButton.click();
        await expect(this.copyInviteLinkButton).toHaveText('Copied');
        return this.container.page().evaluate(() => navigator.clipboard.readText());
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

    async inviteByUsername(username: string) {
        await this.inviteInput.fill(username);
        const option = this.container.getByRole('option', {name: new RegExp(`@${username}`)});
        await expect(option).toBeVisible({timeout: duration.half_min});
        await option.click();
        await this.inviteButton.click();
    }
}
