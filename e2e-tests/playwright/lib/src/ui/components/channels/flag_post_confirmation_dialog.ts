// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect, Page} from '@playwright/test';

export default class FlagPostConfirmationDialog {
    readonly page: Page;
    readonly container: Locator;

    readonly cancelButton;
    readonly flagPostReasonInput;
    readonly flagPostCommentInput;
    readonly submitButton;
    readonly postContainer;
    readonly postText;
    readonly flagReasonOption;
    readonly flagReasonMenuItems;
    readonly cannotFlagPostErrorMessage;
    readonly requireCommentsErrorMessage;

    constructor(container: Locator, page: Page) {
        this.container = container;
        this.page = page;

        this.flagPostReasonInput = container.locator('#FlagPostModal__reason');
        this.flagPostCommentInput = container.locator('#FlagPostModal__comment');
        this.cancelButton = container.locator('button.btn.btn-tertiary');
        this.submitButton = container.locator('button.btn-primary.confirm');
        this.postContainer = container.locator('[data-testid="FlagPostModal__post-preview_container"]');
        this.postText = container.locator('div.post-message__text');
        this.flagReasonOption = page.locator('.react-select__menu-list');
        this.flagReasonMenuItems = (reason: string) =>
            this.flagReasonOption.locator(`div.react-select__option:has-text("${reason}")`);
        this.cannotFlagPostErrorMessage = container.locator('div.FlagPostModal__request-error span');
        this.requireCommentsErrorMessage = container.locator('div.AdvancedTextbox__error-message span');
    }

    async fillFlagComment(comment: string) {
        await this.flagPostCommentInput.fill(comment);
    }

    async selectFlagReason(reason: string) {
        // Open the dropdown
        await this.flagPostReasonInput.click();
        // Wait for dropdown options to appear and click the desired one
        await this.flagReasonOption.waitFor({state: 'visible'});
        await this.flagReasonMenuItems(reason).click();
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await expect(this.cancelButton).toBeVisible();
        await expect(this.submitButton).toBeVisible();
        await expect(this.postContainer).toBeVisible();
    }

    async toContainPostText(message: string) {
        await expect(this.postText).toBeVisible();
        await expect(this.postText).toHaveText(message);
    }

    async notToBeVisible() {
        await expect(this.container).not.toBeVisible();
        await expect(this.cancelButton).not.toBeVisible();
        await expect(this.submitButton).not.toBeVisible();
    }

    async cannotFlagAlreadyFlaggedPostToBeVisible() {
        await expect(this.cannotFlagPostErrorMessage).toBeVisible();
        await expect(this.cannotFlagPostErrorMessage).toHaveText('Cannot flag this post as it is already flagged.');
    }

    async requireCommentsForFlaggingPost() {
        await expect(this.requireCommentsErrorMessage).toBeVisible();
        await expect(this.requireCommentsErrorMessage).toHaveText(
            'Please add a comment explaining why you’re flagging this message.',
        );
    }

    async cannotFlagPreviouslyRetainedPostToBeVisible() {
        await expect(this.cannotFlagPostErrorMessage).toBeVisible();
        await expect(this.cannotFlagPostErrorMessage).toHaveText(
            'Cannot flag this post as it was retained in a previous flagging request.',
        );
    }
}
