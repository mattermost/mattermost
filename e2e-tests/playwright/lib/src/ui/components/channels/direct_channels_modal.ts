// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';
import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export default class DirectChannelsModal {
    readonly container;

    readonly goButton;
    readonly results;
    readonly searchInput;

    constructor(container: Locator) {
        this.container = container;

        this.goButton = container.getByRole('button', {name: 'Go'});
        this.results = container.getByTestId('more-modal-list');
        this.searchInput = container.getByRole('combobox', {name: 'Search for people'});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async selectUser(user: UserProfile) {
        await this.fillSearchInput(user.username);

        // This may fail if there's too many group channels containing the provided user
        const row = this.results.getByTestId('direct-message-row').getByText(`@${user.username}`, {exact: false});

        await row.click();

        await expect(this.container.getByRole('button', {name: `Remove ${user.username}`})).toBeVisible();
    }

    async toHaveNUsersSelected(count: number) {
        await expect(this.container.getByRole('button', {name: /^Remove /})).toHaveCount(count);
    }

    async goToChannel() {
        await this.goButton.click();

        await expect(this.container).not.toBeAttached();
    }

    async toHaveNResults(count: number) {
        await expect(
            this.results.locator('[data-testid="direct-message-row"], [data-testid="group-message-row"]'),
        ).toHaveCount(count);
    }

    async fillSearchInput(text: string) {
        await this.searchInput.fill(text);
    }

    async toHaveUserAsNthResult(user: UserProfile, index: number) {
        const row = this.results
            .locator('[data-testid="direct-message-row"], [data-testid="group-message-row"]')
            .nth(index);

        await expect(row).toContainText(`@${user.username}`);
    }
}
