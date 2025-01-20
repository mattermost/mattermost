// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

export default class MessagePriority {
    readonly container: Locator;
    readonly priorityIcon: Locator;
    readonly priorityMenu: Locator;
    readonly standardPriorityOption: Locator;
    readonly priorityDialog: Locator;
    readonly dialogHeader: Locator;

    constructor(container: Locator) {
        this.container = container;

        // Formatting bar priority icon
        this.priorityIcon = container.locator('#messagePriority');

        // Priority menu that opens when clicking the icon
        this.priorityMenu = container.locator('[role="menu"]').filter({hasText: /Message Priority/});

        // Standard priority option in the menu (id comes from webapp implementation)
        this.standardPriorityOption = this.priorityMenu.locator('#menu-item-priority-standard');

        // Priority dialog elements
        this.priorityDialog = container.page().getByRole('dialog');
        this.dialogHeader = this.priorityDialog.locator('h2.modal-title');
    }

    async clickPriorityIcon() {
        await this.priorityIcon.waitFor({state: 'visible'});
        await this.priorityIcon.click();
    }

    async verifyPriorityIconVisible() {
        await this.priorityIcon.waitFor({state: 'visible'});
        await expect(this.priorityIcon).toBeVisible();
    }

    async verifyStandardPrioritySelected() {
        await expect(this.priorityMenu).toBeVisible();
        await expect(this.standardPriorityOption).toHaveAttribute('aria-checked', 'true');
    }

    async verifyPriorityMenuVisible() {
        await expect(this.priorityMenu).toBeVisible();
        // Look for beta text in header
        await expect(this.priorityMenu.locator('text=Message Priority')).toBeVisible();
    }

    async closePriorityMenu() {
        await this.priorityIcon.click();
        await expect(this.priorityMenu).not.toBeVisible();
    }

    async verifyNoPriorityLabel(postText: string) {
        const post = this.container.locator(`text=${postText}`);
        await expect(post).toBeVisible();

        // Verify no priority label exists
        const priorityLabel = post.locator('[data-testid="post-priority-label"]');
        await expect(priorityLabel).toHaveCount(0);
    }

    async verifyPriorityDialog() {
        await expect(this.priorityDialog).toBeVisible();
        await expect(this.dialogHeader).toHaveText('Message priority');
    }

    async verifyStandardOptionSelected() {
        const standardOption = this.priorityDialog.getByRole('menuitem', {name: 'Standard'});
        await expect(standardOption).toBeVisible();
        await expect(standardOption.locator('svg.StyledCheckIcon-dFKfoY')).toBeVisible();
    }
}

export {MessagePriority};
