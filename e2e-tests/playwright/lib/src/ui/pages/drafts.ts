// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Page, expect} from '@playwright/test';

import {components} from '@/ui/components';

export default class DraftsPage {
    readonly page: Page;

    readonly draftsHeader;
    readonly tab;
    readonly badge;
    readonly noDrafts;

    readonly scheduleMessageModal;

    constructor(page: Page) {
        this.page = page;

        this.draftsHeader = page.locator('.Drafts__header');
        this.tab = page.getByRole('tab', {name: 'Drafts'});
        this.badge = this.tab.locator('span.MuiBadge-badge');

        this.noDrafts = page.locator('.no-results__wrapper');

        this.scheduleMessageModal = new components.ScheduleMessageModal(
            page.getByRole('dialog', {name: 'Schedule message'}),
        );
    }

    async goto(teamName: string) {
        await this.page.goto(`/${teamName}/drafts`);
    }

    async toBeVisible() {
        await expect(this.page).toHaveURL(/.*drafts/);
        await this.draftsHeader.isVisible();
        await expect(this.tab).toHaveAttribute('aria-selected', 'true');
    }

    async getBadgeCountOnTab() {
        await expect(this.tab).toBeVisible();
        const badge = this.tab.locator('span.MuiBadge-badge');
        await expect(badge).toBeVisible();
        return await badge.textContent();
    }

    async getLastPost() {
        const lastPost = this.page.getByTestId('draftView').last();
        await lastPost.waitFor();
        return new components.DraftPost(lastPost);
    }
}
