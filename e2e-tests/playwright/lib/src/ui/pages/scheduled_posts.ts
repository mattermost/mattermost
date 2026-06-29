// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import {expect} from '@playwright/test';

import {components} from '@/ui/components';
import type {ScheduledPost} from '@/ui/components';
import en from '@/i18n';

import type {BaseComponent} from '../base_component';
import {BasePage} from '../base_page';

export default class ScheduledPostsPage extends BasePage {
    readonly components: Record<string, BaseComponent>;

    readonly draftsHeader;
    readonly tab;
    readonly badge;
    readonly noScheduledDrafts;
    readonly scheduleMessageModal;
    readonly sendMessageNowModal;
    readonly deleteScheduledPostModal;

    constructor(page: Page) {
        super(page);

        this.draftsHeader = page.getByTestId('draftsHeader');
        this.tab = page.getByRole('tab', {name: en['schedule_post.tab.heading']});
        this.badge = this.tab.locator('span.MuiBadge-badge');

        this.noScheduledDrafts = page.getByTestId('noResultsWrapper');

        this.scheduleMessageModal = new components.ScheduleMessageModal(
            page.getByRole('dialog', {name: en['schedule_post.custom_time_modal.title']}),
        );
        this.sendMessageNowModal = new components.SendMessageNowModal(
            page.getByRole('dialog', {name: en['drafts.confirm.send.title']}),
        );
        this.deleteScheduledPostModal = new components.DeleteScheduledPostModal(
            page.getByRole('dialog', {name: en['scheduled_post.delete_modal.title']}),
        );

        this.components = {
            scheduleMessageModal: this.scheduleMessageModal,
            sendMessageNowModal: this.sendMessageNowModal,
            deleteScheduledPostModal: this.deleteScheduledPostModal,
        };
    }

    async toBeVisible() {
        await expect(this.page).toHaveURL(/.*scheduled_posts/);
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
        const lastPost = this.page.getByTestId('scheduledPostView').last();
        await lastPost.waitFor();
        return new components.ScheduledPost(lastPost);
    }

    async getLastPostID() {
        return this.page.getByTestId('scheduledPostView').last().getAttribute('data-postid');
    }

    async getNthPost(index: number) {
        const nthPost = this.page.getByTestId('scheduledPostView').nth(index);
        await nthPost.waitFor();
        return new components.ScheduledPost(nthPost);
    }

    async rescheduleMessage(post: ScheduledPost, dayFromToday: number = 0, timeOptionIndex: number = 0) {
        await post.hover();
        await expect(post.rescheduleButton).toBeVisible();
        await post.rescheduleButton.click();

        return this.scheduleMessageModal.scheduleMessage(dayFromToday, timeOptionIndex);
    }

    async goto(teamName: string) {
        await this.page.goto(`/${teamName}/scheduled_posts`);
    }
}
