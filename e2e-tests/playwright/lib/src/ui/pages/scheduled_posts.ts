// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Page, expect} from '@playwright/test';

import {components} from '@/ui/components';
import type {ScheduledPost} from '@/ui/components';

export default class ScheduledPostsPage {
    readonly page: Page;

    readonly draftsHeader;
    readonly tab;
    readonly badge;
    readonly noScheduledDrafts;
    readonly scheduleMessageModal;
    readonly sendMessageNowModal;
    readonly deleteScheduledPostModal;

    constructor(page: Page) {
        this.page = page;

        this.draftsHeader = page.locator('.Drafts__header');
        this.tab = page.getByRole('tab', {name: 'Scheduled'});
        this.badge = this.tab.locator('span.MuiBadge-badge');

        this.noScheduledDrafts = page.locator('.no-results__wrapper');

        this.scheduleMessageModal = new components.ScheduleMessageModal(
            page.getByRole('dialog', {name: 'Schedule message'}),
        );
        this.sendMessageNowModal = new components.SendMessageNowModal(
            page.getByRole('dialog', {name: 'Send message now'}),
        );
        this.deleteScheduledPostModal = new components.DeleteScheduledPostModal(
            page.getByRole('dialog', {name: 'Delete scheduled post'}),
        );
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
        return await badge.textContent();
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

        return await this.scheduleMessageModal.scheduleMessage(dayFromToday, timeOptionIndex);
    }

    async goto(teamName: string) {
        await this.page.goto(`/${teamName}/scheduled_posts`);
    }
}
