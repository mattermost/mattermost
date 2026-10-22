// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

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
     * Uses expect.toPass to handle transient DOM detachments caused by
     * the virtualized message list re-rendering while the click is in flight.
     */
    async reply() {
        await expect(async () => {
            await this.replyButton.click({timeout: 5000});
        }).toPass({timeout: 30000});
    }

    /**
     * Clicks on the dot menu button from the post menu.
     */
    async openDotMenu() {
        await this.dotMenuButton.waitFor();
        await this.dotMenuButton.click();
    }

    /**
     * Clicks on dot menu button.
     */
    async clickOnDotMenu() {
        await this.dotMenuButton.click();
    }
}
