// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export default class ChannelBookmarksCreateModal {
    readonly container: Locator;

    readonly linkInput;
    readonly titleInput;
    readonly addButton;
    readonly saveButton;
    readonly cancelButton;
    readonly emojiButton;
    readonly removeEmojiButton;
    readonly invalidLinkMessage;
    readonly emojiSearchInput;

    constructor(container: Locator) {
        this.container = container;

        this.linkInput = container.getByTestId('linkInput');
        this.titleInput = container.getByTestId('titleInput');
        this.addButton = container.getByRole('button', {name: 'Add bookmark'});
        this.saveButton = container.getByRole('button', {name: 'Save bookmark'});
        this.cancelButton = container.getByRole('button', {name: 'Cancel'});
        this.emojiButton = container.getByRole('button', {name: 'select an emoji'});
        this.removeEmojiButton = container.getByText('Remove emoji');
        this.invalidLinkMessage = container.getByText(
            /Could not find|may not be a valid link|Please enter a valid link|Could not parse/i,
        );
        this.emojiSearchInput = container.page().getByPlaceholder('Search emojis');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async notToBeVisible() {
        await expect(this.container).not.toBeVisible();
    }

    /**
     * Fills the link field and confirms, creating a link bookmark.
     */
    async addLink(url: string) {
        await this.linkInput.fill(url);
        await this.addButton.click();
    }
    async selectEmoji(searchTerm: string) {
        await this.emojiButton.click();
        await expect(this.emojiSearchInput).toBeVisible();
        await this.emojiSearchInput.fill(searchTerm);
        await this.emojiSearchInput.press('Enter');
    }
}
