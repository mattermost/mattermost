// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import {expect} from '@playwright/test';

import {components} from '@/ui/components';
import en from '@/i18n';

import {BasePage} from '../base_page';
import type {BaseComponent} from '../base_component';

export default class DraftsPage extends BasePage {
    readonly components: Record<string, BaseComponent>;

    readonly draftsHeader;
    readonly tab;
    readonly badge;
    readonly noDrafts;

    readonly scheduleMessageModal;

    constructor(page: Page) {
        super(page);

        this.draftsHeader = page.getByTestId('draftsHeader');
        this.tab = page.getByRole('tab', {name: en['drafts.heading']});
        this.badge = this.tab.locator('span.MuiBadge-badge');

        this.noDrafts = page.getByTestId('noResultsWrapper');

        this.scheduleMessageModal = new components.ScheduleMessageModal(
            page.getByRole('dialog', {name: en['schedule_post.custom_time_modal.title']}),
        );

        this.components = {scheduleMessageModal: this.scheduleMessageModal};
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
        return badge.textContent();
    }

    async getLastPost() {
        const lastPost = this.page.getByTestId('draftView').last();
        await lastPost.waitFor();
        return new components.DraftPost(lastPost);
    }
}
