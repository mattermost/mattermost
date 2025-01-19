// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator, Page} from '@playwright/test';

export default class PostMenu {
    readonly container: Locator;

    readonly plusOneEmojiButton;
    readonly grinningEmojiButton;
    readonly whiteCheckMarkEmojiButton;
    readonly addReactionButton;
    readonly saveButton;
    readonly replyButton;
    readonly actionsButton;
    readonly dotMenuButton;

    constructor(container: Locator) {
        this.container = container;

        this.plusOneEmojiButton = container.getByRole('button', {name: '+1 emoji'});
        this.grinningEmojiButton = container.getByRole('button', {name: 'grinning emoji'});
        this.whiteCheckMarkEmojiButton = container.getByRole('button', {name: 'white check mark emoji'});
        this.addReactionButton = container.getByRole('button', {name: 'add reaction'});
        this.saveButton = container.getByRole('button', {name: 'save'});
        this.actionsButton = container.getByRole('button', {name: 'actions'});
        this.replyButton = container.getByRole('button', {name: 'reply'});
        this.dotMenuButton = container.getByRole('button', {name: 'more'});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    /**
     * Clicks on the reply button from the post menu.
     */
    async reply() {
        await this.replyButton.waitFor();
        await this.replyButton.click();
    }

    /**
     * Clicks on the dot menu button from the post menu.
     */
    async openDotMenu() {
        await this.dotMenuButton.waitFor();
        await this.dotMenuButton.click();
    }

    /**
     * Clicks on dot menu and move the mouse away to not open sub menu
     */
    async clickOnDotMenu(page: Page) {
        await this.dotMenuButton.click();
        // move the mouse away from menu since the focus opens a submenu and causes test to fail
        await page.mouse.move(0, 0);
    }
}

export {PostMenu};
