// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';

import {UserActionMenu} from './user_action_menu';

/**
 * Users table component
 */
export class UsersTable extends BaseComponent {
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
    readonly channelCountHeader: Locator;
    readonly actionsHeader: Locator;

    // Column visibility controls
    readonly toggleColumnButton: Locator;
    readonly columnVisibilityMenu: Locator;

    constructor(container: Locator) {
        super(container);
        this.headerRow = container.locator('thead tr');
        this.bodyRows = container.locator('tbody tr');

        // Column visibility controls
        this.toggleColumnButton = container.page().locator('#systemUsersColumnTogglerMenuButton');
        this.columnVisibilityMenu = container.page().locator('#systemUsersColumnTogglerMenu');

        // Column headers
        this.userDetailsHeader = container.locator('#systemUsersTable-header-usernameColumn');
        this.emailHeader = container.locator('#systemUsersTable-header-emailColumn');
        this.memberSinceHeader = container.locator('#systemUsersTable-header-createAtColumn');
        this.lastLoginHeader = container.locator('#systemUsersTable-header-lastLoginColumn');
        this.lastActivityHeader = container.locator('#systemUsersTable-header-lastStatusAtColumn');
        this.lastPostHeader = container.locator('#systemUsersTable-header-lastPostDateColumn');
        this.daysActiveHeader = container.locator('#systemUsersTable-header-daysActiveColumn');
        this.messagesPostedHeader = container.locator('#systemUsersTable-header-totalPostsColumn');
        this.channelCountHeader = container.locator('#systemUsersTable-header-channelCountColumn');
        this.actionsHeader = container.locator('#systemUsersTable-header-actionsColumn');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    /**
     * Get a column header by display name using accessible role
     */
    columnHeaderByName(name: string): Locator {
        return this.container.getByRole('columnheader', {name});
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
            'Channel count': this.channelCountHeader,
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

    getFirstRow(): UserRow {
        return new UserRow(this.bodyRows.first(), 0);
    }

    /**
     * Wait for the table to finish loading (spinner to disappear)
     */
    async waitForLoadingComplete() {
        // Wait for any loading spinners to disappear
        const loadingSpinner = this.container.getByTestId('loadingSpinner');
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
export class UserRow extends BaseComponent {
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
    readonly channelCountCell: Locator;
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
        super(container);
        this.index = index;

        this.userDetailsCell = container.getByTestId('usernameColumn');
        this.emailCell = container.getByTestId('emailColumn');
        this.memberSinceCell = container.getByTestId('createAtColumn');
        this.lastLoginCell = container.getByTestId('lastLoginColumn');
        this.lastActivityCell = container.getByTestId('lastStatusAtColumn');
        this.lastPostCell = container.getByTestId('lastPostDateColumn');
        this.daysActiveCell = container.getByTestId('daysActiveColumn');
        this.messagesPostedCell = container.getByTestId('totalPostsColumn');
        this.channelCountCell = container.getByTestId('channelCountColumn');
        this.actionsCell = container.getByTestId('actionsColumn');

        this.profilePicture = this.userDetailsCell.getByTestId('adminUserTableProfilePicture');
        this.displayName = this.userDetailsCell.getByTestId('adminUserTableDisplayName');
        this.userName = this.userDetailsCell.getByTestId('adminUserTableUserName');

        this.actionMenuButton = this.actionsCell.getByRole('button');

        this.actionMenu = new UserActionMenu(container.page().locator(`#actionMenu-systemUsersTable-${index}`));
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    getColumnCellByClass(cssClass: string): Locator {
        return this.container.locator(`.${cssClass}`);
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

    /**
     * Get the status badge locator by text (e.g. 'Deactivated')
     */
    getStatusBadge(text: string): Locator {
        return this.container.getByText(text, {exact: true});
    }

    /**
     * Get the role badge locator by text (e.g. 'Member', 'System Admin')
     */
    getRoleBadge(text: string): Locator {
        return this.container.getByText(text, {exact: true});
    }
}
