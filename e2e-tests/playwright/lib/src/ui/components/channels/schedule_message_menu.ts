// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export default class ScheduleMessageMenu {
    readonly container: Locator;

    readonly tomorrowMenuItem;
    readonly mondayMenuItem;
    readonly nextMondayMenuItem;
    readonly recentlyUsedCustomTimeMenuItem;
    readonly customTimeMenuItem;

    // The preset time options offered, which vary with the current weekday
    readonly presetTimeMenuItems;

    // In mobile view the menu renders inside a full-height dialog instead of a popover.
    // Clicking the dimmed area of the dialog around the panel dismisses the menu.
    readonly mobileDialog;
    readonly mobileDialogPanel;

    constructor(container: Locator) {
        this.container = container;

        this.tomorrowMenuItem = container.getByTestId('scheduling_time_tomorrow_9_am');
        this.mondayMenuItem = container.getByTestId('scheduling_time_monday_9_am');
        this.nextMondayMenuItem = container.getByTestId('scheduling_time_next_monday_9_am');
        this.recentlyUsedCustomTimeMenuItem = container.getByTestId('recently_used_custom_time');
        this.customTimeMenuItem = container.getByText('Choose a custom time');
        this.presetTimeMenuItems = container.locator('[data-testid^="scheduling_time_"]');

        this.mobileDialog = container.locator('.modal-dialog.menuModal');
        this.mobileDialogPanel = this.mobileDialog.locator('.modal-content');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async selectCustomTime() {
        await this.customTimeMenuItem.click();
    }

    async toBeVisibleAsMobileDialog() {
        await this.toBeVisible();
        await expect(this.mobileDialog).toBeVisible();
    }

    async toBeHidden() {
        await expect(this.mobileDialog).toBeHidden();
        await expect(this.container).toBeHidden();
    }

    async clickOutsideMobileDialog() {
        await expect(this.mobileDialogPanel).toBeVisible();

        const dialogBox = await this.mobileDialog.boundingBox();
        const panelBox = await this.mobileDialogPanel.boundingBox();
        expect(dialogBox).not.toBeNull();
        expect(panelBox).not.toBeNull();

        // Guard against clicking the plain backdrop outside the dialog, which dismisses
        // the menu even without the dialog letting clicks through to it
        const dimmedAreaHeight = panelBox!.y - dialogBox!.y;
        expect(dimmedAreaHeight).toBeGreaterThan(20);

        await this.mobileDialog
            .page()
            .mouse.click(panelBox!.x + panelBox!.width / 2, panelBox!.y - dimmedAreaHeight / 2);
    }
}
