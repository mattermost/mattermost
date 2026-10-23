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
    readonly memberLimitHelpText;
    readonly newConversationWarning;

    constructor(container: Locator) {
        this.container = container;

        this.goButton = container.getByRole('button', {name: 'Go'});
        this.results = container.getByTestId('more-modal-list');
        this.searchInput = container.getByRole('combobox', {name: 'Search for people'});
        this.memberLimitHelpText = container.locator('#multiSelectHelpMemberInfo');
        this.newConversationWarning = container.getByText(
            "This will start a new conversation. If you're adding a lot of people, consider creating a private channel instead.",
        );
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async selectUser(user: UserProfile) {
        await this.fillSearchInput(user.username);

        // This may fail if there's too many group channels containing the provided user
        const row = this.results.getByTestId('direct-message-row').getByText(`@${user.username}`, {exact: false});

        await row.click();

        await expect(this.getRemoveButton(user.username)).toBeVisible();
    }

    /**
     * Locates the "Remove {username}" button for a selected user.
     * @param username
     */
    getRemoveButton(username: string): Locator {
        return this.container.getByRole('button', {name: `Remove ${username}`});
    }

    async removeUser(username: string) {
        await this.getRemoveButton(username).click();
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

    /**
     * Types into the search input and waits for the modal's server-side user search for that term.
     * The modal first lists locally matching users, then swaps every row for a loading screen while
     * that search runs, so a row clicked before it answers can be unmounted mid-click.
     */
    async fillSearchInput(text: string) {
        const searchResponse = text
            ? this.container
                  .page()
                  .waitForResponse(
                      (response) =>
                          response.url().endsWith('/api/v4/users/search') &&
                          response.request().postDataJSON()?.term === text,
                  )
            : undefined;

        await this.searchInput.fill(text);
        await searchResponse;
    }

    getUserResult(username: string) {
        return this.results.getByText(`@${username}`, {exact: false});
    }

    async openSelfDirectMessage(username: string) {
        await this.fillSearchInput(username);
        await expect(this.getUserResult(username)).toBeVisible();
        await this.getUserResult(username).click();
        await expect(this.container).not.toBeAttached();
    }

    async toHaveUserAsNthResult(user: UserProfile, index: number) {
        const row = this.results
            .locator('[data-testid="direct-message-row"], [data-testid="group-message-row"]')
            .nth(index);

        await expect(row).toContainText(`@${user.username}`);
    }
}
