// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

export default class MembersInvitedModal extends BaseComponent {
    readonly doneButton: Locator;
    readonly inviteMoreButton: Locator;

    readonly sentSection: Locator;
    readonly notSentSection: Locator;

    constructor(container: Locator) {
        super(container);

        this.doneButton = container.getByRole('button', {name: en['invitation_modal.confirm.done']});
        this.inviteMoreButton = container.getByRole('button', {name: en['invitation_modal.invite.more']});

        this.sentSection = container.getByTestId('invitationResultsSent');
        this.notSentSection = container.getByTestId('invitationResultsNotSent');
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
        return (await this.sentSection.getByTestId('inviteResultReason').textContent()) ?? '';
    }

    /**
     * Returns the result reason text for a not-sent invite row.
     */
    async getNotSentResultReason(): Promise<string> {
        await expect(this.notSentSection).toBeVisible();
        return (await this.notSentSection.getByTestId('inviteResultReason').textContent()) ?? '';
    }

    /**
     * Clicks the "Invite More People" button to return to the invite form.
     */
    async clickInviteMore() {
        await expect(this.inviteMoreButton).toBeVisible();
        await this.inviteMoreButton.click();
    }
}
