// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

/**
 * The "Select team" dropdown used to scope search to a specific team or "All Teams".
 * The same underlying menu is rendered both in the search composer and in the search
 * results panel header — construct with the container scoped to whichever one you need
 * (they share the `searchTeamsSelectorMenuButton` test id, so an unscoped page-level
 * locator is ambiguous once both are present in the DOM).
 */
export default class SearchTeamSelector {
    readonly container: Locator;
    readonly menuButton: Locator;

    constructor(container: Locator) {
        this.container = container;
        this.menuButton = container.getByTestId('searchTeamsSelectorMenuButton');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async notToBeVisible() {
        await expect(this.container).not.toBeVisible();
    }

    /**
     * The dropdown menu. Only present in the DOM while open.
     */
    get menu(): Locator {
        return this.container.page().getByRole('menu', {name: 'Select team'});
    }

    /**
     * Opens the dropdown and returns the menu locator.
     */
    async open() {
        await this.menuButton.click();
        await expect(this.menu).toBeVisible();
        return this.menu;
    }

    /**
     * A specific team's option in the dropdown, by display name. Pass "All Teams" for the all-teams option.
     */
    teamOption(displayName: string): Locator {
        return this.menu.getByRole('menuitemradio', {name: displayName});
    }

    /**
     * Opens the dropdown and selects the given team by display name.
     */
    async selectTeam(displayName: string) {
        await this.open();
        await this.teamOption(displayName).click();
    }

    /**
     * Opens the dropdown and selects "All Teams".
     */
    async selectAllTeams() {
        await this.selectTeam('All Teams');
    }

    /**
     * The "Search teams" filter input. Only rendered once the user belongs to more than 4 teams.
     */
    get filterInput(): Locator {
        return this.menu.getByLabel('Search teams');
    }

    async filterBy(text: string) {
        await this.filterInput.fill(text);
    }

    /**
     * The "Your teams" section header. Only rendered when a specific team (not "All Teams")
     * is selected, and only when the user belongs to more than 4 teams.
     *
     * Uses a text locator rather than `getByRole('separator', {name: ...})`: per the ARIA spec,
     * the `separator` role doesn't support "name from content" (only `aria-label`), so the role
     * has no accessible name here and a role+name locator would never match despite the text
     * being visibly present.
     */
    get yourTeamsHeader(): Locator {
        return this.menu.getByText('Your teams');
    }

    /**
     * Closes the dropdown by pressing Escape, without changing the current selection.
     */
    async close() {
        await this.container.page().keyboard.press('Escape');
    }
}
