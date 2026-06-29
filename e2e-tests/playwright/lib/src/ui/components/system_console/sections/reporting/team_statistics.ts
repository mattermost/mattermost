// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

/**
 * System Console -> Reporting -> Team Statistics
 */
export default class TeamStatistics extends BaseComponent {
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
        super(container);
        this.header = container.getByTestId('teamStatisticsHeader');

        this.teamFilterDropdown = container.getByTestId('teamFilter');

        this.banner = container.getByTestId('teamStatisticsBanner');

        this.totalActivatedUsers = new StatCard(container.getByTestId('totalActiveUsersCard'), 'totalActiveUsers');
        this.publicChannels = new StatCard(container.getByTestId('publicChannelsCard'), 'publicChannels');
        this.privateChannels = new StatCard(container.getByTestId('privateChannelsCard'), 'privateChannels');
        this.totalPosts = new StatCard(container.getByTestId('totalPostsCountCard'), 'totalPostsCount');

        this.totalPostsChart = new ChartSection(container.getByTestId('totalPostsChart'), 'totalPosts');
        this.activeUsersWithPostsChart = new ChartSection(
            container.getByTestId('activeUsersWithPostsChart'),
            'activeUsersWithPosts',
        );

        this.recentActiveUsers = new TableSection(container.getByTestId('recentActiveUsers'), 'recentActiveUsers');
        this.newlyCreatedUsers = new TableSection(container.getByTestId('newlyCreatedUsers'), 'newlyCreatedUsers');
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
        const heading = this.container.getByText(en['analytics.team.title'].replace('{team}', teamDisplayName), {
            exact: true,
        });
        await expect(heading).toBeVisible();
    }
}

class StatCard extends BaseComponent {
    readonly title: Locator;
    readonly value: Locator;

    constructor(container: Locator, id: string) {
        super(container);
        this.title = container.getByTestId(`${id}Title`);
        this.value = container.getByTestId(id);
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async getValue(): Promise<string> {
        return (await this.value.textContent()) ?? '';
    }
}

class ChartSection extends BaseComponent {
    readonly title: Locator;
    readonly content: Locator;

    constructor(container: Locator, id: string) {
        super(container);
        this.title = container.getByTestId(`${id}ChartTitle`);
        this.content = container.getByTestId(`${id}ChartContent`);
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async hasNoData(): Promise<boolean> {
        const text = await this.content.textContent();
        return text?.includes(en['analytics.chart.meaningful']) ?? false;
    }
}

class TableSection extends BaseComponent {
    readonly title: Locator;
    readonly table: Locator;

    constructor(container: Locator, testId: string) {
        super(container);
        this.title = container.getByTestId(`${testId}Title`);
        this.table = container.getByTestId(`${testId}Table`);
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }
}
