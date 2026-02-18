// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

import {UserActionMenu} from './user_action_menu';

/**
 * Users table component
 */
export class UsersTable {
    readonly container: Locator;
    readonly headerRow: Locator;
    readonly bodyRows: Locator;

    // Column headers
    readonly userDetailsHeader: Locator;
    readonly emailHeader: Locator;
    readonly memberSinceHeader: Locator;
    readonly lastLoginHeader: Locator;
    readonly lastActivityHeader: Locator;
    readonly lastPostHeader: Locator;
    readonly daysActiveHeader: Locator;
    readonly messagesPostedHeader: Locator;
    readonly actionsHeader: Locator;

    constructor(container: Locator) {
        this.container = container;
        this.headerRow = container.locator('thead tr');
        this.bodyRows = container.locator('tbody tr');

        // Column headers
        this.userDetailsHeader = container.locator('#systemUsersTable-header-usernameColumn');
        this.emailHeader = container.locator('#systemUsersTable-header-emailColumn');
        this.memberSinceHeader = container.locator('#systemUsersTable-header-createAtColumn');
        this.lastLoginHeader = container.locator('#systemUsersTable-header-lastLoginColumn');
        this.lastActivityHeader = container.locator('#systemUsersTable-header-lastStatusAtColumn');
        this.lastPostHeader = container.locator('#systemUsersTable-header-lastPostDateColumn');
        this.daysActiveHeader = container.locator('#systemUsersTable-header-daysActiveColumn');
        this.messagesPostedHeader = container.locator('#systemUsersTable-header-totalPostsColumn');
        this.actionsHeader = container.locator('#systemUsersTable-header-actionsColumn');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    /**
     * Get a user row by index (0-based)
     */
    getRowByIndex(index: number): UserRow {
        return new UserRow(this.bodyRows.nth(index), index);
    }

    /**
     * Get a column header by display name
     */
    getColumnHeader(columnName: string): Locator {
        const headerMap: Record<string, Locator> = {
            'User details': this.userDetailsHeader,
            Email: this.emailHeader,
            'Member since': this.memberSinceHeader,
            'Last login': this.lastLoginHeader,
            'Last activity': this.lastActivityHeader,
            'Last post': this.lastPostHeader,
            'Days active': this.daysActiveHeader,
            'Messages posted': this.messagesPostedHeader,
            Actions: this.actionsHeader,
        };
        const header = headerMap[columnName];
        if (!header) {
            throw new Error(`Unknown column: ${columnName}`);
        }
        return header;
    }

    /**
     * Click on a column header to sort by that column
     */
    async clickSortOnColumn(columnName: string) {
        const header = this.getColumnHeader(columnName);
        await header.click();
    }

    /**
     * Click on a sortable column header and wait for sort to complete
     * @param columnName - The display name of the column
     * @returns The new sort direction after clicking
     */
    async sortByColumn(columnName: string): Promise<'ascending' | 'descending' | 'none'> {
        const header = this.getColumnHeader(columnName);

        // Get current sort direction
        const currentSort = await header.getAttribute('aria-sort');

        // Click to sort
        await header.click();

        // Wait for sort direction to change (or for it to be set if it wasn't before)
        if (currentSort) {
            // Wait for the attribute to change
            await expect(header).not.toHaveAttribute('aria-sort', currentSort);
        } else {
            // Wait for the attribute to be set
            await expect(header).toHaveAttribute('aria-sort');
        }

        // Wait for table to stabilize
        await this.waitForLoadingComplete();

        // Return the new sort direction
        const newSort = await header.getAttribute('aria-sort');
        return (newSort as 'ascending' | 'descending' | 'none') ?? 'none';
    }

    /**
     * Wait for the table to finish loading (spinner to disappear)
     */
    async waitForLoadingComplete() {
        // Wait for any loading spinners to disappear
        const loadingSpinner = this.container.locator('.loading-screen, .LoadingSpinner');
        await loadingSpinner.waitFor({state: 'detached', timeout: 10000}).catch(() => {
            // Spinner may not appear for fast loads, ignore timeout
        });
        // Also wait for at least one row to be visible
        await this.bodyRows.first().waitFor({state: 'visible'});
    }
}

/**
 * A single row in the users table
 */
export class UserRow {
    readonly container: Locator;
    readonly index: number;

    // Cells
    readonly userDetailsCell: Locator;
    readonly emailCell: Locator;
    readonly memberSinceCell: Locator;
    readonly lastLoginCell: Locator;
    readonly lastActivityCell: Locator;
    readonly lastPostCell: Locator;
    readonly daysActiveCell: Locator;
    readonly messagesPostedCell: Locator;
    readonly actionsCell: Locator;

    // User details components
    readonly profilePicture: Locator;
    readonly displayName: Locator;
    readonly userName: Locator;

    // Action menu button
    readonly actionMenuButton: Locator;

    // Action menu (populated after opening)
    private readonly actionMenu: UserActionMenu;

    constructor(container: Locator, index: number) {
        this.container = container;
        this.index = index;

        this.userDetailsCell = container.locator('.usernameColumn');
        this.emailCell = container.locator('.emailColumn');
        this.memberSinceCell = container.locator('.createAtColumn');
        this.lastLoginCell = container.locator('.lastLoginColumn');
        this.lastActivityCell = container.locator('.lastStatusAtColumn');
        this.lastPostCell = container.locator('.lastPostDateColumn');
        this.daysActiveCell = container.locator('.daysActiveColumn');
        this.messagesPostedCell = container.locator('.totalPostsColumn');
        this.actionsCell = container.locator('.actionsColumn');

        this.profilePicture = this.userDetailsCell.locator('.profilePicture');
        this.displayName = this.userDetailsCell.locator('.displayName');
        this.userName = this.userDetailsCell.locator('.userName');

        this.actionMenuButton = this.actionsCell.getByRole('button');

        this.actionMenu = new UserActionMenu(container.page().locator(`#actionMenu-systemUsersTable-${index}`));
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    /**
     * Click on the row to view user details
     */
    async click() {
        await this.container.click();
    }

    /**
     * Get the email
     */
    async getEmail(): Promise<string> {
        return (await this.emailCell.textContent()) ?? '';
    }

    /**
     * Click the action menu button to open the actions dropdown
     * Returns the action menu for further interactions
     */
    async openActionMenu(): Promise<UserActionMenu> {
        await this.actionMenuButton.click();
        await this.actionMenu.toBeVisible();
        return this.actionMenu;
    }
}
