// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

export default class MembersInvitedModal {
    readonly container: Locator;

    readonly doneButton: Locator;
    readonly inviteMoreButton: Locator;

    readonly sentSection: Locator;
    readonly notSentSection: Locator;

    constructor(container: Locator) {
        this.container = container;

        this.doneButton = container.getByRole('button', {name: 'Done'});
        this.inviteMoreButton = container.getByRole('button', {name: 'Invite More People'});

        this.sentSection = container.locator('.invitation-modal-confirm--sent');
        this.notSentSection = container.locator('.invitation-modal-confirm--not-sent');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async close() {
        await this.doneButton.click();
    }

    /**
     * Returns the result reason text for a sent invite row.
     */
    async getSentResultReason(): Promise<string> {
        await expect(this.sentSection).toBeVisible();
        return (await this.sentSection.locator('.InviteResultRow .reason').textContent()) ?? '';
    }

    /**
     * Returns the result reason text for a not-sent invite row.
     */
    async getNotSentResultReason(): Promise<string> {
        await expect(this.notSentSection).toBeVisible();
        return (await this.notSentSection.locator('.InviteResultRow .reason').textContent()) ?? '';
    }

    /**
     * Clicks the "Invite More People" button to return to the invite form.
     */
    async clickInviteMore() {
        await expect(this.inviteMoreButton).toBeVisible();
        await this.inviteMoreButton.click();
    }
}
