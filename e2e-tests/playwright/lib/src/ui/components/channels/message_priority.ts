// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

export default class MessagePriority extends BaseComponent {
    readonly priorityIcon: Locator;
    readonly priorityMenu: Locator;
    readonly standardPriorityOption: Locator;
    readonly priorityDialog: Locator;
    readonly dialogHeader: Locator;

    constructor(container: Locator) {
        super(container);

        // Formatting bar priority icon
        this.priorityIcon = container.locator('#messagePriority');

        // Priority menu that opens when clicking the icon
        this.priorityMenu = container.locator('[role="menu"]');

        // Priority dialog elements
        this.priorityDialog = container.page().getByRole('menu');
        this.dialogHeader = this.priorityDialog.getByRole('heading', {name: en['post_priority.picker.header']});

        // Standard priority option in the menu
        this.standardPriorityOption = this.priorityDialog.getByRole('menuitemradio', {
            name: en['post_priority.priority.standard'],
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

    async verifyStandardPrioritySelected() {
        await expect(this.priorityMenu).toBeVisible();
        await expect(this.standardPriorityOption).toHaveAttribute('aria-checked', 'true');
    }

    async verifyPriorityMenuVisible() {
        await expect(this.priorityMenu).toBeVisible();
        await expect(this.priorityMenu.getByText(en['post_priority.picker.header'])).toBeVisible();
    }

    async closePriorityMenu() {
        await this.priorityMenu.press('Escape');
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
        await expect(this.dialogHeader).toHaveText(en['post_priority.picker.header']);
    }
}
