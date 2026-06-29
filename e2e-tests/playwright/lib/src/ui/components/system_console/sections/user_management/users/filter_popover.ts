// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

type RoleFilter =
    | 'Any'
    | 'System Admin'
    | 'Member'
    | 'Guests (all)'
    | 'Guests in a single channel'
    | 'Guests in multiple channels';
type StatusFilter = 'Any' | 'Activated users' | 'Deactivated users';

/**
 * Filter popover that appears when clicking the Filters button in System Console -> Users
 */
export class FilterPopover extends BaseComponent {
    // Exposed dropdowns (getby-analysis)
    readonly teamDropdown: Locator;
    readonly roleDropdown: Locator;
    readonly statusDropdown: Locator;

    readonly applyButton: Locator;

    constructor(container: Locator) {
        super(container);
        this.teamDropdown = container.locator('#asyncTeamSelectInput');
        this.roleDropdown = container.locator('#DropdownInput_filterRole');
        this.statusDropdown = container.locator('#DropdownInput_filterStatus');
        this.applyButton = container.getByText(en['admin.system_users.filtersPopover.apply']);
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await expect(this.applyButton).toBeVisible();
    }

    /**
     * Save/apply the filter settings. The Apply button closes the popover.
     */
    async save() {
        await this.applyButton.click();
        await expect(this.container).not.toBeVisible({timeout: 5000});
    }

    /**
     * Close the popover via Escape if it is still open.
     */
    async close() {
        const isVisible = await this.container.isVisible();
        if (isVisible) {
            await this.container.press('Escape');
            await expect(this.container).not.toBeVisible();
        }
    }

    /**
     * Type a team name into the team dropdown and wait for async results.
     */
    async searchInTeamMenu(teamDisplayName: string) {
        await expect(this.teamDropdown).toBeVisible();
        await this.teamDropdown.fill(teamDisplayName);
        await this.container.page().waitForTimeout(500);
    }

    /**
     * Select a team from the team dropdown.
     * For "All teams" and "No teams" the dropdown is opened directly;
     * for any other value the input is searched first.
     */
    async filterByTeam(team: 'All teams' | 'No teams' | string) {
        if (team === 'All teams' || team === 'No teams') {
            await expect(this.teamDropdown).toBeVisible();
            await this.teamDropdown.click();
        } else {
            await this.searchInTeamMenu(team);
        }
        const option = this.container.getByRole('option', {name: team});
        await option.waitFor();
        await option.click();
    }

    /**
     * Open the role filter dropdown.
     */
    async openRoleMenu() {
        await expect(this.roleDropdown).toBeVisible();
        await this.roleDropdown.click();
    }

    /**
     * Open the role filter dropdown and select a role option.
     */
    async filterByRole(role: RoleFilter) {
        await this.openRoleMenu();
        const option = this.container.getByRole('option', {name: role});
        await option.waitFor();
        await option.click();
    }

    /**
     * Open the status filter dropdown.
     */
    async openStatusMenu() {
        await expect(this.statusDropdown).toBeVisible();
        await this.statusDropdown.click();
    }

    /**
     * Open the status filter dropdown and select a status option.
     */
    async filterByStatus(status: StatusFilter) {
        await this.openStatusMenu();
        const option = this.container.getByRole('option', {name: status});
        await option.waitFor();
        await option.click();
    }
}
