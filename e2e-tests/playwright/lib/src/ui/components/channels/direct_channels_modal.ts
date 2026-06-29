// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';
import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

export default class DirectChannelsModal extends BaseComponent {
    readonly goButton;
    readonly results;
    readonly searchInput;
    readonly multiSelectList: Locator;
    readonly selectedRows: Locator;
    readonly rows: Locator;
    readonly noResultsWrapper: Locator;
    readonly srOnlyRegion: Locator;
    readonly noResultsMessage: Locator;

    constructor(container: Locator) {
        super(container);

        this.goButton = container.getByRole('button', {name: en['multiselect.go']});
        this.results = container.getByTestId('moreModalList');
        this.searchInput = container.getByRole('combobox', {name: en['multiselect.placeholder']});
        this.multiSelectList = container.locator('#multiSelectList');
        this.selectedRows = this.multiSelectList.locator('[aria-selected="true"]');
        this.rows = this.multiSelectList.locator('[data-testid$="ChannelRow"]');
        this.noResultsWrapper = container.getByTestId('multiSelectWrapper');
        this.srOnlyRegion = container.getByTestId('multiselectAriaAnnouncer');
        this.noResultsMessage = container.getByTestId('noResultMessage');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async selectUser(user: UserProfile) {
        await this.fillSearchInput(user.username);

        // This may fail if there's too many group channels containing the provided user
        const row = this.results.getByTestId('directChannelRow').getByText(`@${user.username}`, {exact: false});

        await row.click();

        await expect(this.container.getByRole('button', {name: `Remove ${user.username}`})).toBeVisible();
    }

    async toHaveNUsersSelected(count: number) {
        await expect(this.container.getByTestId('multiselectValueRemove')).toHaveCount(count);
    }

    async goToChannel() {
        await this.goButton.click();

        await expect(this.container).not.toBeAttached();
    }

    async toHaveNResults(count: number) {
        await expect(this.results.locator('[data-testid$="ChannelRow"]')).toHaveCount(count);
    }

    async fillSearchInput(text: string) {
        await this.searchInput.fill(text);
    }

    async toHaveUserAsNthResult(user: UserProfile, index: number) {
        const row = this.results.locator('[data-testid$="ChannelRow"]').nth(index);

        await expect(row).toContainText(`@${user.username}`);
    }

    getRowByUsername(username: string): Locator {
        return this.rows.filter({hasText: username});
    }

    getGmIconInRow(row: Locator): Locator {
        return row.getByTestId('gmChannelIcon');
    }

    getGmNameInRow(row: Locator): Locator {
        return row.getByTestId('gmChannelName');
    }

    getAvatarInRow(row: Locator): Locator {
        return row.getByAltText(/avatar/i);
    }
}
