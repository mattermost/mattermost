// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Page} from '@playwright/test';

export default class DraftPage {
    readonly page: Page;

    readonly badgeCountOnScheduledTab;
    readonly confirmbutton;
    readonly datePattern;
    readonly deleteIcon;
    readonly deleteIconToolTip;
    readonly noscheduledDraftIcon;
    readonly scheduleIcon;
    readonly rescheduleIconToolTip;
    readonly draftBody;
    readonly scheduledDraftPageInfo;
    readonly scheduledDraftPanel;
    readonly scheduledDraftSendNowButton;
    readonly scheduledDraftSendNowButtonToolTip;

    constructor(page: Page) {
        this.page = page;
        this.draftBody = page.locator('div.post__body');
        this.scheduleIcon = page.locator('#draft_icon-clock-send-outline_reschedule');

        this.datePattern =
            /(Today|Tomorrow|(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}) at \d{1,2}:\d{2} [AP]M/;
        this.badgeCountOnScheduledTab = page.locator('a#draft_tabs-tab-0 div.drafts_tab_title span.MuiBadge-badge');
        // this.scheduledDraftPageInfo = page.locator('span:has-text("Send on")');
        this.scheduledDraftPageInfo = page.locator('.PanelHeader__info');
        this.scheduledDraftPanel = (messageContent: string) =>
            page.locator(`article.Panel:has(div.post__body:has-text("${messageContent}"))`);
        this.deleteIcon = page.locator('#draft_icon-trash-can-outline_delete');
        this.deleteIconToolTip = page.locator('text=Delete scheduled post');
        this.rescheduleIconToolTip = page.locator('text=Schedule draft');
        this.noscheduledDraftIcon = page.locator('.no-results__wrapper');
        this.scheduledDraftSendNowButton = page.locator('#draft_icon-send-outline_sendNow');
        this.scheduledDraftSendNowButtonToolTip = page.locator('text=Send now');
        this.confirmbutton = this.page.locator('button.btn-primary');
    }

    async goTo(teamName: string) {
        await this.page.goto(`/${teamName}/drafts`);
    }

    async toBeVisible() {
        await this.page.waitForLoadState('networkidle');
        await expect(this.page).toHaveURL(/.*drafts/);
    }

    async assertBadgeCountOnTab(badgeCount: string) {
        await this.badgeCountOnScheduledTab.isVisible();
        await expect(this.badgeCountOnScheduledTab).toHaveText(badgeCount);
    }

    async assertDraftBody(draftMessage: string) {
        await expect(this.draftBody).toBeVisible();
        await expect(this.draftBody).toHaveText(draftMessage);
    }

    async verifyOnHoverActionItems(messageContent: string) {
        await this.scheduledDraftPanel(messageContent).isVisible();
        await this.scheduledDraftPanel(messageContent).hover();
        await this.verifyDeleteIcon();
        await this.verifyScheduleIcon(messageContent);
        await this.verifySendNowIcon();
    }

    async verifyDeleteIcon() {
        await this.deleteIcon.isVisible();
        await this.deleteIcon.hover();
        await expect(this.deleteIconToolTip).toBeVisible();
        await expect(this.deleteIconToolTip).toHaveText('Delete scheduled post');
    }

    async verifyScheduleIcon(messageContent: string) {
        await this.scheduledDraftPanel(messageContent).hover();
        await expect(this.scheduleIcon).toBeVisible();
        await this.scheduleIcon.hover();
        await expect(this.rescheduleIconToolTip).toBeVisible();
        await expect(this.rescheduleIconToolTip).toHaveText('Schedule draft');
    }

    async verifySendNowIcon() {
        await this.scheduledDraftSendNowButton.isVisible();
        await this.scheduledDraftSendNowButton.hover();
        await expect(this.scheduledDraftSendNowButtonToolTip).toBeVisible();
        await expect(this.scheduledDraftSendNowButtonToolTip).toHaveText('Send now');
    }

    async getTimeStampOfMessage(messageContent: string) {
        await this.scheduledDraftPanel(messageContent).scrollIntoViewIfNeeded();
        await this.scheduledDraftPanel(messageContent).isVisible();
        return this.scheduledDraftPanel(messageContent).locator(this.scheduledDraftPageInfo).innerHTML();
    }

    async openScheduleModal(messageContent: string) {
        await this.scheduledDraftPanel(messageContent).scrollIntoViewIfNeeded();
        await this.scheduledDraftPanel(messageContent).isVisible();
        await this.scheduledDraftPanel(messageContent).hover();
        await this.scheduleIcon.hover();
        await expect(this.rescheduleIconToolTip).toBeVisible();
        await expect(this.rescheduleIconToolTip).toHaveText('Schedule draft');
        await this.scheduleIcon.click();
    }

    async deleteScheduledMessage(messageContent: string) {
        await this.scheduledDraftPanel(messageContent).isVisible();
        await this.scheduledDraftPanel(messageContent).hover();
        await this.verifyDeleteIcon();
        await this.deleteIcon.click();
        expect(await this.confirmbutton.textContent()).toEqual('Yes, delete');
        await this.confirmbutton.click();
    }

    async sendScheduledMessage(messageContent: string) {
        await this.scheduledDraftPanel(messageContent).isVisible();
        await this.scheduledDraftPanel(messageContent).hover();
        await this.verifySendNowIcon();
        await this.scheduledDraftSendNowButton.click();
        expect(await this.confirmbutton.textContent()).toEqual('Yes, send now');
        await this.confirmbutton.click();
    }
}

export {DraftPage};
