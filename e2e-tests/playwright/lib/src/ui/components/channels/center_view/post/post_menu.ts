// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

export default class PostMenu extends BaseComponent {
    readonly plusOneEmojiButton;
    readonly grinningEmojiButton;
    readonly whiteCheckMarkEmojiButton;
    readonly addReactionButton;
    readonly saveButton;
    readonly replyButton;
    readonly actionsButton;
    readonly dotMenuButton;

    constructor(container: Locator) {
        super(container);

        const emojiLabel = (name: string) => en['emoji_picker_item.emoji_aria_label'].replace('{emojiName}', name);
        this.plusOneEmojiButton = container.getByRole('button', {name: emojiLabel('+1')});
        this.grinningEmojiButton = container.getByRole('button', {name: emojiLabel('grinning')});
        this.whiteCheckMarkEmojiButton = container.getByRole('button', {name: emojiLabel('white check mark')});
        this.addReactionButton = container.getByRole('button', {name: en['post_info.tooltip.add_reactions']});
        this.saveButton = container.getByRole('button', {name: en['flag_post.flag']});
        this.actionsButton = container.getByRole('button', {name: en['post_info.actions.tooltip.actions']});
        this.replyButton = container.getByRole('button', {name: en['post_info.comment_icon.tooltip.reply']});
        this.dotMenuButton = container.getByRole('button', {name: en['post_info.dot_menu.tooltip.more']});
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
