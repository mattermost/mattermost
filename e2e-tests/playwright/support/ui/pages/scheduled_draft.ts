// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Page} from '@playwright/test';

export default class ScheduledDraftPage {
    readonly page: Page;

    readonly badgeCountOnScheduledTab;
    readonly confirmbutton;
    readonly copyIcon;
    readonly copyIconToolTip;
    readonly datePattern;
    readonly deleteIcon;
    readonly deleteIconToolTip;
    readonly noscheduledDraftIcon;
    readonly rescheduleIcon;
    readonly rescheduleIconToolTip;
    readonly scheduledDraftBody;
    readonly scheduledDraftPageInfo;
    readonly scheduledDraftPanel;
    readonly scheduledDraftSendNowButton;
    readonly scheduledDraftSendNowButtonToolTip;
    readonly editIcon;
    readonly editBox;
    readonly editorSaveButton;

    constructor(page: Page) {
        this.page = page;

        this.datePattern =
            /(Today|Tomorrow|(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}) at \d{1,2}:\d{2} [AP]M/;
        this.scheduledDraftBody = page.locator('div.post__body');
        this.badgeCountOnScheduledTab = page.locator('a#draft_tabs-tab-1 div.drafts_tab_title span.MuiBadge-badge');
        this.scheduledDraftPageInfo = page.locator('.PanelHeader__info');
        this.scheduledDraftPanel = (messageContent: string) =>
            page.locator(`article.Panel:has(div.post__body:has-text("${messageContent}"))`);
        this.deleteIcon = page.locator('#draft_icon-trash-can-outline_delete');
        this.deleteIconToolTip = page.locator('text=Delete scheduled post');
        this.copyIcon = page.locator('#draft_icon-content-copy_copy_text');
        this.copyIconToolTip = page.locator('text=Copy text');
        this.rescheduleIcon = page.locator('#draft_icon-clock-send-outline_reschedule');
        this.rescheduleIconToolTip = page.locator('text=Reschedule post');
        this.noscheduledDraftIcon = page.locator('.no-results__wrapper');
        this.scheduledDraftSendNowButton = page.locator('#draft_icon-send-outline_sendNow');
        this.scheduledDraftSendNowButtonToolTip = page.locator('text=Send now');
        this.confirmbutton = this.page.locator('button.btn-primary');
        this.editIcon = page.locator('#draft_icon-pencil-outline_edit');
        this.editBox = page.locator('textarea#edit_textbox');
        this.editorSaveButton = page.locator('button.save');
    }

    async toBeVisible() {
        await this.page.waitForLoadState('networkidle');
        await expect(this.page).toHaveURL(/.*scheduled_posts/);
    }

    async assertBadgeCountOnTab(badgeCount: string) {
        await this.badgeCountOnScheduledTab.isVisible();
        await expect(this.badgeCountOnScheduledTab).toHaveText(badgeCount);
    }

    async assertscheduledDraftBody(draftMessage: string) {
        await expect(this.scheduledDraftBody).toBeVisible();
        await expect(this.scheduledDraftBody).toHaveText(draftMessage);
    }

    async verifyOnHoverActionItems(messageContent: string) {
        await this.scheduledDraftPanel(messageContent).isVisible();
        await this.scheduledDraftPanel(messageContent).hover();
        await this.verifyDeleteIcon();
        await this.verifyCopyIcon();
        await this.verifyRescheduleIcon();
        await this.verifySendNowIcon();
    }

    async verifyDeleteIcon() {
        await this.deleteIcon.isVisible();
        await this.deleteIcon.hover();
        await expect(this.deleteIconToolTip).toBeVisible();
        await expect(this.deleteIconToolTip).toHaveText('Delete scheduled post');
    }

    async verifyCopyIcon() {
        await this.copyIcon.isVisible();
        await this.copyIcon.hover();
        await expect(this.copyIconToolTip).toBeVisible();
        await expect(this.copyIconToolTip).toHaveText('Copy text');
    }

    async verifyRescheduleIcon() {
        await expect(this.rescheduleIcon).toBeVisible();
        await this.rescheduleIcon.hover();
        await expect(this.rescheduleIconToolTip).toBeVisible();
        await expect(this.rescheduleIconToolTip).toHaveText('Reschedule post');
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

    async openRescheduleModal(messageContent: string) {
        await this.scheduledDraftPanel(messageContent).scrollIntoViewIfNeeded();
        await this.scheduledDraftPanel(messageContent).isVisible();
        await this.scheduledDraftPanel(messageContent).hover();
        await this.rescheduleIcon.hover();
        await expect(this.rescheduleIconToolTip).toBeVisible();
        await expect(this.rescheduleIconToolTip).toHaveText('Reschedule post');
        await this.rescheduleIcon.click();
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

    async goTo(teamName: string) {
        await this.page.goto(`/${teamName}/scheduled_posts`);
    }

    async editText(newText: string) {
        await this.editIcon.click();
        await this.editBox.isVisible();
        await this.editBox.fill(newText);
        await this.editorSaveButton.isVisible();
        await this.editorSaveButton.click();
        await this.editBox.isHidden();
        await this.scheduledDraftPanel(newText).isVisible();
    }

    async copyScheduledMessage(draftMessage: string) {
        await this.scheduledDraftPanel(draftMessage).isVisible();
        await this.scheduledDraftPanel(draftMessage).hover();
        await this.verifyCopyIcon();
        await this.copyIcon.click();
    }
}

export {ScheduledDraftPage};
