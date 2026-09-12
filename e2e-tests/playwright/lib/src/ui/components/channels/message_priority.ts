// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export type PriorityOption = 'Standard' | 'Important' | 'Urgent';

export default class MessagePriority {
    readonly container: Locator;
    readonly priorityIcon: Locator;
    readonly priorityMenu: Locator;
    readonly dialogHeader: Locator;
    readonly standardPriorityOption: Locator;
    readonly importantPriorityOption: Locator;
    readonly urgentPriorityOption: Locator;
    readonly applyButton: Locator;
    readonly cancelButton: Locator;
    readonly persistentNotificationsToggle: Locator;

    constructor(container: Locator) {
        this.container = container;

        // Formatting bar priority icon
        this.priorityIcon = container.locator('#messagePriority');

        this.priorityMenu = container.page().getByRole('menu', {name: 'Post priority options'});

        // Header and footer render as siblings of the menu list, not inside it.
        this.dialogHeader = container.page().getByRole('heading', {name: 'Message priority', level: 4});
        this.standardPriorityOption = this.priorityMenu.getByRole('menuitemradio', {name: 'Standard'});
        this.importantPriorityOption = this.priorityMenu.getByRole('menuitemradio', {name: 'Important'});
        this.urgentPriorityOption = this.priorityMenu.getByRole('menuitemradio', {name: 'Urgent'});

        this.applyButton = container.page().getByRole('button', {name: 'Apply'});
        this.cancelButton = container.page().getByRole('button', {name: 'Cancel'});
        this.persistentNotificationsToggle = this.priorityMenu.getByRole('menuitemcheckbox', {
            name: 'Send persistent notifications',
        });
    }

    async clickPriorityIcon() {
        await this.priorityIcon.waitFor({state: 'visible'});
        await this.priorityIcon.click();
    }

    async verifyPriorityIconVisible() {
        await this.priorityIcon.waitFor({state: 'visible'});
        await expect(this.priorityIcon).toBeVisible();
    }

    async verifyPriorityDialog() {
        await expect(this.priorityMenu).toBeVisible();
        await expect(this.dialogHeader).toBeVisible();
    }

    async verifyPriorityMenuVisible() {
        await expect(this.priorityMenu).toBeVisible();
        await expect(this.dialogHeader).toBeVisible();
    }

    async verifyStandardPrioritySelected() {
        await expect(this.priorityMenu).toBeVisible();
        await expect(this.standardPriorityOption).toHaveAttribute('aria-checked', 'true');
    }

    async verifyImportantPrioritySelected() {
        await expect(this.priorityMenu).toBeVisible();
        await expect(this.importantPriorityOption).toHaveAttribute('aria-checked', 'true');
    }

    async verifyUrgentPrioritySelected() {
        await expect(this.priorityMenu).toBeVisible();
        await expect(this.urgentPriorityOption).toHaveAttribute('aria-checked', 'true');
    }

    option(priority: PriorityOption) {
        switch (priority) {
            case 'Important':
                return this.importantPriorityOption;
            case 'Urgent':
                return this.urgentPriorityOption;
            default:
                return this.standardPriorityOption;
        }
    }

    async selectPriority(priority: PriorityOption) {
        const option = this.option(priority);
        await option.click();
        await expect(option).toHaveAttribute('aria-checked', 'true');
    }

    async apply() {
        await expect(this.applyButton).toBeVisible();
        await this.applyButton.click();
        await expect(this.priorityMenu).not.toBeVisible();
    }

    /**
     * Selects a priority and applies it. When acknowledgements are enabled the picker
     * stays open until Apply is clicked; otherwise selecting a priority closes it.
     */
    async selectAndApply(priority: PriorityOption) {
        await this.selectPriority(priority);

        if (await this.applyButton.isVisible()) {
            await this.apply();
            return;
        }

        await expect(this.priorityMenu).not.toBeVisible();
    }

    async closePriorityMenu() {
        await this.priorityMenu.press('Escape');
        await expect(this.priorityMenu).not.toBeVisible();
    }

    async verifyNoPriorityLabel(postText: string) {
        const post = this.container.getByText(postText);
        await expect(post).toBeVisible();

        const priorityLabel = post.locator('[data-testid="post-priority-label"]');
        await expect(priorityLabel).toHaveCount(0);
    }

    async verifyPriorityLabel(scope: Locator, priority: Exclude<PriorityOption, 'Standard'>) {
        const label = scope.getByTestId('post-priority-label');
        await expect(label).toBeVisible();
        await expect(label).toHaveText(new RegExp(priority, 'i'));
    }

    async verifyNoPriorityLabelIn(scope: Locator) {
        await expect(scope.getByTestId('post-priority-label')).toHaveCount(0);
    }
}
