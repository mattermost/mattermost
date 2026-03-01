// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

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
        this.header = container.locator('.team-statistics__header');

        this.teamFilterDropdown = container.getByTestId('teamFilter');

        this.banner = container.locator('.banner');

        const gridStatistics = container.locator('.grid-statistics');
        this.totalActivatedUsers = new StatCard(
            gridStatistics.locator('.grid-statistics__card').filter({hasText: 'Total Activated Users'}),
        );
        this.publicChannels = new StatCard(
            gridStatistics.locator('.grid-statistics__card').filter({hasText: 'Public Channels'}),
        );
        this.privateChannels = new StatCard(
            gridStatistics.locator('.grid-statistics__card').filter({hasText: 'Private Channels'}),
        );
        this.totalPosts = new StatCard(
            gridStatistics.locator('.grid-statistics__card').filter({hasText: 'Total Posts'}),
        );

        this.totalPostsChart = new ChartSection(
            container.locator('.total-count.by-day').filter({hasText: 'Total Posts'}),
        );
        this.activeUsersWithPostsChart = new ChartSection(
            container.locator('.total-count.by-day').filter({hasText: 'Active Users With Posts'}),
        );

        this.recentActiveUsers = new TableSection(
            container.locator('.recent-active-users').filter({hasText: 'Recent Active Users'}),
        );
        this.newlyCreatedUsers = new TableSection(
            container.locator('.recent-active-users').filter({hasText: 'Newly Created Users'}),
        );
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

    constructor(container: Locator) {
        this.container = container;
        this.title = container.locator('.title');
        this.value = container.locator('.content');
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

    constructor(container: Locator) {
        this.container = container;
        this.title = container.locator('.title');
        this.content = container.locator('.content');
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

    constructor(container: Locator) {
        this.container = container;
        this.title = container.locator('.title');
        this.table = container.locator('table');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }
}
