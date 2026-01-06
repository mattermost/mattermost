// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Page, Locator, expect} from '@playwright/test';

import {wait} from '@/util';

export default class ContentReviewPage {
    private readonly page: Page;
    private readonly cards: Locator;
    private readonly rhsCard: Locator;
    private reportCard?: Locator;
    readonly keepMessageButton: Locator;
    readonly removeMessageButton: Locator;
    readonly postActionConformationModal: Locator;
    readonly cancelButton: Locator;
    readonly confirmRemoveMessageButton: Locator;
    readonly confirmKeepMessageButton: Locator;
    readonly confirmationModalComment: Locator;

    constructor(page: Page) {
        this.page = page;
        this.cards = page.locator('[data-testid="property-card-view"]');
        this.rhsCard = page.getByTestId('rhsPostView').getByTestId('property-card-view');
        this.keepMessageButton = this.rhsCard.getByTestId('data-spillage-action-keep-message');
        this.removeMessageButton = this.rhsCard.getByTestId('data-spillage-action-remove-message');
        this.postActionConformationModal = page.locator('div.GenericModal__wrapper');
        this.cancelButton = this.postActionConformationModal.getByRole('button', {name: 'Cancel'});
        this.confirmRemoveMessageButton = this.postActionConformationModal.getByRole('button', {
            name: 'Remove message',
        });
        this.confirmKeepMessageButton = this.postActionConformationModal.getByRole('button', {name: 'Keep message'});
        this.confirmationModalComment = this.postActionConformationModal.getByTestId(
            'RemoveFlaggedMessageConfirmationModal__comment',
        );
    }

    async setReportCardByPostID(postID: string) {
        this.reportCard = this.page
            .locator('div.DataSpillageReport')
            .filter({has: this.page.locator(`#postMessageText_${postID}`)});
    }

    private ensureReportCardSet() {
        if (!this.reportCard) {
            throw new Error('Report card not set. Call setReportCardByPostID(postID) first.');
        }
    }

    async openViewDetails() {
        this.ensureReportCardSet();
        const button = this.reportCard!.locator('button:has-text("View Details")');
        await button.scrollIntoViewIfNeeded();
        await button.click();
    }

    async waitForPageLoaded() {
        await this.page.waitForResponse(
            (res) => res.url().includes('as_content_reviewer=true') && res.status() === 200,
        );
        await this.page.waitForTimeout(1000);
        await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        this.ensureReportCardSet();
        await expect(this.reportCard!).toBeVisible();
    }

    async getLastCard(): Promise<Locator> {
        const count = await this.cards.count();
        if (count === 0) throw new Error('No content review cards found.');
        return this.cards.nth(count - 1);
    }

    async openCardByMessage(message: string) {
        const targetCard = this.page
            .locator('div.DataSpillageReport')
            .filter({has: this.page.locator(`.row:has-text("${message}")`)});
        await targetCard.first().click();
    }

    private field(fieldName: string): Locator {
        return this.rhsCard.locator('.row', {
            has: this.rhsCard.locator(`.field:has-text("${fieldName}")`),
        });
    }

    /**
     * Gets the value text for a given field label (e.g. "Status", "Reason", etc.)
     */
    async getValueForField(fieldName: string): Promise<string> {
        await expect(this.rhsCard).toBeVisible({timeout: 10000});
        const valueLocator = this.rhsCard.locator(`.row:has(.field:has-text("${fieldName}")) .value`);
        await expect(valueLocator).toBeVisible({timeout: 5000});
        return valueLocator.innerText();
    }

    /**
     * Asserts that a field's value matches the expected text
     */
    async expectSelectProperty(fieldName: string, expectedValue: string): Promise<void> {
        const actualValue = await this.getValueForField(fieldName);
        expect(actualValue.trim()).toBe(expectedValue);
    }

    async expectTextProperty(fieldName: string, expected: string) {
        await expect(this.field(fieldName).locator('.TextProperty')).toHaveText(expected);
    }

    async expectUser(fieldName: string, expected: string) {
        await expect(this.rhsCard).toBeVisible({timeout: 10000});

        const userButton = this.rhsCard.locator(`.row:has(.field:has-text("${fieldName}")) .user-popover`);

        // Wait for either visible or attached then read text
        await userButton.waitFor({state: 'attached', timeout: 10000});
        const text = (await userButton.innerText()).trim();
        expect(text).toBe(expected);
    }

    async expectTeam(expected: string) {
        await expect(this.rhsCard.locator('.TeamPropertyRenderer')).toContainText(expected);
    }

    async expectChannel(expected: string) {
        await expect(this.rhsCard.locator('.ChannelPropertyRenderer')).toContainText(expected);
    }

    async expectMessageContains(expected: string) {
        await expect(this.rhsCard.locator('.post-message__text')).toContainText(expected);
    }

    async waitForRHSVisible() {
        await this.page.waitForResponse(
            (res) => res.url().includes('as_content_reviewer=true') && res.status() === 200,
        );

        const gotIt = this.page.getByRole('button', {name: 'Got it'});
        if (await gotIt.isVisible()) {
            await gotIt.click();
        }
        await wait(5000);
    }

    async verifyFlaggedPostStatus(expected: string) {
        this.ensureReportCardSet();
        await expect(this.reportCard!.locator('.row:has-text("Status") .SelectProperty')).toHaveText(expected);
    }

    async verifyFlaggedPostReason(expected: string) {
        this.ensureReportCardSet();
        await expect(this.reportCard!.locator('.row:has-text("Reason") .SelectProperty')).toHaveText(expected);
    }

    async verifyFlaggedPostMessage(expected: string) {
        this.ensureReportCardSet();
        await expect(this.reportCard!.locator('.row:has-text("Message") .post-message__text')).toHaveText(expected);
    }

    async clickKeepMessage() {
        await this.keepMessageButton.scrollIntoViewIfNeeded();
        await this.keepMessageButton.click();
        await this.postActionConformationModal.waitFor({state: 'visible'});
    }

    async clickRemoveMessage() {
        await this.removeMessageButton.scrollIntoViewIfNeeded();
        await this.removeMessageButton.click();
        await this.postActionConformationModal.waitFor({state: 'visible'});
    }

    async enterConfirmationComment(comment: string) {
        await this.confirmationModalComment.fill(comment);
    }

    async confirmRemove() {
        await this.confirmRemoveMessageButton.click();
        await this.postActionConformationModal.waitFor({state: 'hidden'});
    }

    async confirmKeep() {
        await this.confirmKeepMessageButton.click();
        await this.postActionConformationModal.waitFor({state: 'hidden'});
    }
}
