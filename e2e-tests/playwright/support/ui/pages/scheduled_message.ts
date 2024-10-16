// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Page} from '@playwright/test';

export default class ScheduledMessagePage {
    readonly page: Page;

    readonly badgeCountOnScheduledTab;
    readonly datePattern;
    readonly deleteIcon;
    readonly deleteIconToolTip;
    readonly rescheduleIcon;
    readonly rescheduleIconToolTip;
    readonly scheduledMessageBody;
    readonly scheduledMessagePageInfo;
    readonly scheduledMessagePanel;

    constructor(page: Page) {
        this.page = page;

        this.datePattern =
            /(Today|Tomorrow|(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}) at \d{1,2}:\d{2} [AP]M/;
        this.scheduledMessageBody = page.locator('div.post__body');
        this.badgeCountOnScheduledTab = page.locator('a#draft_tabs-tab-1 div.drafts_tab_title span.MuiBadge-badge');
        this.scheduledMessagePageInfo = page.locator('span:has-text("Send on")');
        this.scheduledMessagePanel = (messageContent: string) =>
            page.locator(`article.Panel:has(div.post__body:has-text("${messageContent}"))`);
        this.deleteIcon = page.locator('#draft_icon-trash-can-outline_delete');
        this.deleteIconToolTip = page.locator('text=Delete scheduled post');
        this.rescheduleIcon = page.locator('#draft_icon-clock-send-outline_reschedule');
        this.rescheduleIconToolTip = page.locator('text=Reschedule post');
    }

    async toBeVisible() {
        await this.page.waitForLoadState('networkidle');
        await expect(this.page).toHaveURL(/.*scheduled_posts/);
    }

    async assertBadgeCountOnTab(badgeCount: string) {
        await this.badgeCountOnScheduledTab.isVisible();
        await expect(this.badgeCountOnScheduledTab).toHaveText(badgeCount);
    }

    async assertScheduledMessageBody(draftMessage: string) {
        await expect(this.scheduledMessageBody).toBeVisible();
        await expect(this.scheduledMessageBody).toHaveText(draftMessage);
    }

    async verifyOnHoverActionItems(messageContent: string) {
        await this.scheduledMessagePanel(messageContent).isVisible();
        await this.scheduledMessagePanel(messageContent).hover();
        await this.deleteIcon.isVisible();
        await this.deleteIcon.hover();
        await expect(this.deleteIconToolTip).toBeVisible();
        await expect(this.deleteIconToolTip).toHaveText('Delete scheduled post');
        await expect(this.rescheduleIcon).toBeVisible();
        await this.rescheduleIcon.hover();
        await expect(this.rescheduleIconToolTip).toBeVisible();
        await expect(this.rescheduleIconToolTip).toHaveText('Reschedule post');
    }
}

export {ScheduledMessagePage};
