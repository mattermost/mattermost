// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page, Locator} from '@playwright/test';
import {expect} from '@playwright/test';

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
    readonly downloadReportCheckbox: Locator;
    readonly formContinueButton: Locator;
    readonly removePermanentlyButton: Locator;
    readonly keepPermanentlyButton: Locator;
    readonly removeWithoutReportButton: Locator;
    readonly generatedSection: Locator;

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
        this.downloadReportCheckbox = this.postActionConformationModal.getByTestId('download-report-checkbox');
        this.formContinueButton = this.postActionConformationModal.getByRole('button', {name: 'Continue'});
        this.removePermanentlyButton = this.postActionConformationModal.getByRole('button', {
            name: 'Remove permanently',
        });
        this.keepPermanentlyButton = this.postActionConformationModal.getByRole('button', {name: 'Keep permanently'});
        this.removeWithoutReportButton = this.postActionConformationModal.getByRole('button', {
            name: 'Remove without report',
        });
        this.generatedSection = this.postActionConformationModal.getByTestId('generated-section');
    }

    async setReportCardByPostID(postID: string) {
        this.reportCard = this.page
            .locator('div.DataSpillageReport')
            .filter({has: this.page.locator(`#postMessageText_${postID}`)});
        if ((await this.reportCard.count()) === 0) {
            this.reportCard = this.page.locator('div.DataSpillageReport').first();
        }
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
        await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        this.ensureReportCardSet();
        await expect(this.reportCard!).toBeVisible({timeout: 15000});
    }

    async getLastCard(): Promise<Locator> {
        const count = await this.cards.count();
        if (count === 0) {
            throw new Error('No content review cards found.');
        }
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

    async verifyFlaggedPostMessageInRHS(expected: string) {
        await expect(this.rhsCard.locator('.row:has-text("Message") .post-message__text')).toHaveText(expected);
    }

    async verifyFlaggedPostMessageInCenter(postID: string, expected: string) {
        const centerCard = this.page
            .getByTestId('channel_view')
            .locator('div.DataSpillageReport')
            .filter({has: this.page.locator(`#postMessageText_${postID}`)});
        await expect(centerCard.locator('.row:has-text("Message") .post-message__text')).toHaveText(expected);
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

    /**
     * From the form step, advance to the report-generated step
     * (downloadReport checkbox is on by default).
     */
    async submitFormAndWaitForReport() {
        await this.formContinueButton.click();
        await expect(this.generatedSection).toBeVisible({timeout: 30000});
    }

    async confirmRemovePermanently() {
        await this.removePermanentlyButton.click();
        await this.postActionConformationModal.waitFor({state: 'hidden'});
    }

    async confirmKeepPermanently() {
        await this.keepPermanentlyButton.click();
        await this.postActionConformationModal.waitFor({state: 'hidden'});
    }

    /**
     * Skip-report path: uncheck the download checkbox, submit the form to reach
     * the skip-confirm step, then confirm removal without a report.
     */
    async confirmRemoveWithoutReport() {
        await this.downloadReportCheckbox.uncheck();
        await this.confirmRemoveMessageButton.click();
        await expect(this.removeWithoutReportButton).toBeVisible({timeout: 10000});
        await this.removeWithoutReportButton.click();
        await this.postActionConformationModal.waitFor({state: 'hidden'});
    }
}
