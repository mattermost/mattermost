// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

/**
 * System Console -> User Management -> Users
 */
export default class SystemUsers {
    readonly container: Locator;

    readonly searchInput: Locator;
    readonly columnToggleMenuButton: Locator;
    readonly dateRangeSelectorMenuButton: Locator;
    readonly exportButton: Locator;
    readonly filterPopoverButton: Locator;
    readonly actionMenuButtons: Locator[];

    readonly loadingSpinner: Locator;

    constructor(container: Locator) {
        this.container = container;

        this.searchInput = this.container.getByLabel('Search users');
        this.columnToggleMenuButton = this.container.locator('#systemUsersColumnTogglerMenuButton');
        this.dateRangeSelectorMenuButton = this.container.locator('#systemUsersDateRangeSelectorMenuButton');
        this.exportButton = this.container.getByText('Export');
        this.filterPopoverButton = this.container.getByText(/Filters \(\d+\)/);
        this.actionMenuButtons = Array.from(Array(10).keys()).map((index) =>
            this.container.locator(`#actionMenuButton-systemUsersTable-${index}`),
        );

        this.loadingSpinner = this.container.getByText('Loading');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async isLoadingComplete() {
        await expect(this.loadingSpinner).toHaveCount(0);
    }

    /**
     * Returns the locator for the header of the given column.
     */
    async getColumnHeader(columnName: string) {
        const columnHeader = this.container.getByRole('columnheader').filter({hasText: columnName});
        return columnHeader;
    }

    /**
     * Checks if given column exists in the table. By searching for the column header.
     */
    async doesColumnExist(columnName: string) {
        const columnHeader = await this.getColumnHeader(columnName);
        return await columnHeader.isVisible();
    }

    /**
     * Clicks on the column header of the given column for sorting.
     */
    async clickSortOnColumn(columnName: string) {
        const columnHeader = await this.getColumnHeader(columnName);
        await columnHeader.waitFor();
        await columnHeader.click();
    }

    /**
     * Return the locator for the given row number. If '0' is passed, it will return the header row.
     */
    async getNthRow(rowNumber: number) {
        const row = this.container.getByRole('row').nth(rowNumber);
        await row.waitFor();

        return row;
    }

    /**
     * Opens the Filter popover
     */
    async openFilterPopover() {
        expect(this.filterPopoverButton).toBeVisible();
        await this.filterPopoverButton.click();
    }

    /**
     * Open the column toggle menu
     */
    async openColumnToggleMenu() {
        expect(this.columnToggleMenuButton).toBeVisible();
        await this.columnToggleMenuButton.click();
    }

    /**
     * Open the date range selector menu
     */
    async openDateRangeSelectorMenu() {
        expect(this.dateRangeSelectorMenuButton).toBeVisible();
        await this.dateRangeSelectorMenuButton.click();
    }

    /**
     * Enter the given search term in the search input
     */
    async enterSearchText(searchText: string) {
        expect(this.searchInput).toBeVisible();
        await this.searchInput.fill(`${searchText}`);

        await this.isLoadingComplete();
    }

    /**
     * Searches and verifies that the row with given text is found
     */
    async verifyRowWithTextIsFound(text: string) {
        const foundUser = this.container.getByText(text);
        await foundUser.waitFor();

        await expect(foundUser).toBeVisible();
    }

    /**
     * Searches and verifies that the row with given text is not found
     */
    async verifyRowWithTextIsNotFound(text: string) {
        const foundUser = this.container.getByText(text);
        await expect(foundUser).not.toBeVisible();
    }
}

export {SystemUsers};
