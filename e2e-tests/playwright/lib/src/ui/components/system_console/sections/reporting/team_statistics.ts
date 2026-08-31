// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

/**
 * System Console -> Reporting -> Team Statistics
 */
export default class TeamStatistics {
    readonly container: Locator;
    readonly header: Locator;

    // Team filter
    readonly teamFilterDropdown: Locator;

    // Banner
    readonly banner: Locator;

    // Statistics cards
    readonly totalActivatedUsers: StatCard;
    readonly publicChannels: StatCard;
    readonly privateChannels: StatCard;
    readonly totalPosts: StatCard;

    // Charts
    readonly totalPostsChart: ChartSection;
    readonly activeUsersWithPostsChart: ChartSection;

    // Tables
    readonly recentActiveUsers: TableSection;
    readonly newlyCreatedUsers: TableSection;

    constructor(container: Locator) {
        this.container = container;
        this.header = container.getByTestId('team-statistics-header');

        this.teamFilterDropdown = container.getByTestId('teamFilter');

        this.banner = container.getByTestId('team-statistics-banner');

        this.totalActivatedUsers = new StatCard(container.getByTestId('totalActiveUsersCard'), 'totalActiveUsers');
        this.publicChannels = new StatCard(container.getByTestId('publicChannelsCard'), 'publicChannels');
        this.privateChannels = new StatCard(container.getByTestId('privateChannelsCard'), 'privateChannels');
        this.totalPosts = new StatCard(container.getByTestId('totalPostsCard'), 'totalPosts');

        this.totalPostsChart = new ChartSection(container.getByTestId('totalPostsChart'), 'totalPosts');
        this.activeUsersWithPostsChart = new ChartSection(
            container.getByTestId('activeUsersWithPostsChart'),
            'activeUsersWithPosts',
        );

        this.recentActiveUsers = new TableSection(container.getByTestId('recentActiveUsersChart'), 'recentActiveUsers');
        this.newlyCreatedUsers = new TableSection(container.getByTestId('newlyCreatedUsersChart'), 'newlyCreatedUsers');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await expect(this.header).toBeVisible();
    }

    async selectTeam(teamName: string) {
        // Wait for the dropdown to be enabled (it may be disabled while loading)
        await expect(this.teamFilterDropdown).toBeEnabled();
        await this.teamFilterDropdown.selectOption({label: teamName});
    }

    async selectTeamById(teamId: string) {
        // Wait for the dropdown to be enabled (it may be disabled while loading)
        await expect(this.teamFilterDropdown).toBeEnabled();
        await this.teamFilterDropdown.selectOption({value: teamId});
    }

    async getSelectedTeam(): Promise<string> {
        return (await this.teamFilterDropdown.inputValue()) ?? '';
    }

    /**
     * Verify the team statistics header shows the expected team name
     */
    async toHaveTeamHeader(teamDisplayName: string) {
        const heading = this.container.getByText(`Team Statistics for ${teamDisplayName}`, {exact: true});
        await expect(heading).toBeVisible();
    }
}

class StatCard {
    readonly container: Locator;
    readonly title: Locator;
    readonly value: Locator;

    constructor(container: Locator, id: string) {
        this.container = container;
        // statistic_count.tsx renders data-testid="{id}Title" and data-testid="{id}" for title/value
        this.title = container.getByTestId(id + 'Title');
        this.value = container.getByTestId(id);
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async getValue(): Promise<string> {
        return (await this.value.textContent()) ?? '';
    }
}

class ChartSection {
    readonly container: Locator;
    readonly title: Locator;
    readonly content: Locator;

    constructor(container: Locator, id: string) {
        this.container = container;
        // line_chart.tsx renders data-testid="{id}Title" and data-testid="{id}Content"
        this.title = container.getByTestId(id + 'Title');
        this.content = container.getByTestId(id + 'Content');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async hasNoData(): Promise<boolean> {
        const text = await this.content.textContent();
        return text?.includes('Not enough data') ?? false;
    }
}

class TableSection {
    readonly container: Locator;
    readonly title: Locator;
    readonly table: Locator;

    constructor(container: Locator, id: string) {
        this.container = container;
        // table_chart.tsx renders data-testid="{id}Title" and data-testid="{id}Content"
        this.title = container.getByTestId(id + 'Title');
        this.table = container.getByTestId(id + 'Content').locator('table');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }
}
