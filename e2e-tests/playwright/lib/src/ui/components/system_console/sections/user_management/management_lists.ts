// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import {expect} from '@playwright/test';

import {duration} from '@/util';

/**
 * System Console -> User Management list pages for teams, channels, and LDAP groups.
 */
export default class ManagementLists {
    readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    async gotoChannels() {
        await this.page.goto('/admin_console/user_management/channels');
        await expect(this.page.getByRole('heading', {name: 'Channels', exact: true})).toBeVisible({
            timeout: duration.half_min,
        });
    }

    async gotoTeams() {
        await this.page.goto('/admin_console/user_management/teams');
        await expect(this.page.getByRole('heading', {name: 'Teams', exact: true})).toBeVisible({
            timeout: duration.half_min,
        });
    }

    async gotoGroups() {
        await this.page.goto('/admin_console/user_management/groups');
        await expect(this.page.getByText('AD/LDAP Groups', {exact: true})).toBeVisible({
            timeout: duration.half_min,
        });
    }

    async search(value: string) {
        const searchInput = this.page.getByPlaceholder('Search');
        await searchInput.fill(value);
        await searchInput.press('Enter');
    }

    async expectSearchToBeEmpty() {
        await expect(this.page.getByPlaceholder('Search', {exact: true})).toHaveValue('');
    }

    async expectRowCount(count: number) {
        await expect(this.page.getByRole('link', {name: 'Edit', exact: true})).toHaveCount(count, {
            timeout: duration.half_min,
        });
    }

    async expectChannelResult(displayName: string) {
        await expect(this.page.getByTestId('channel-display-name').getByText(displayName, {exact: true})).toBeVisible({
            timeout: duration.half_min,
        });
    }

    async expectTeamManagementLabel(teamName: string, label: 'Anyone Can Join' | 'Invite Only') {
        await expect(this.page.getByTestId(`${teamName}Management`).getByText(label, {exact: true})).toBeVisible({
            timeout: duration.half_min,
        });
    }

    async expectPagination(text: string) {
        await expect(this.page.getByText(text, {exact: true})).toBeVisible({timeout: duration.half_min});
    }

    async goToNextPage() {
        await this.page.getByRole('button', {name: 'Next page', exact: true}).click();
    }

    async clearSearch() {
        await this.page.getByTestId('clear-search').click();
    }

    async clearSearchWithKeyboard() {
        await this.page.getByPlaceholder('Search', {exact: true}).fill('');
    }

    async openOnlyResult() {
        await this.page.getByRole('link', {name: 'Edit', exact: true}).click();
    }
}
