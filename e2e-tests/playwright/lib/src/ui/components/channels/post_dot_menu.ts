// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

export default class PostDotMenu extends BaseComponent {
    readonly replyMenuItem;
    readonly forwardMenuItem;
    readonly followMessageMenuItem;
    readonly markAsUnreadMenuItem;
    readonly remindMenuItem;
    readonly saveMenuItem;
    readonly removeFromSavedMenuItem;
    readonly pinToChannelMenuItem;
    readonly unpinFromChannelMenuItem;
    readonly moveThreadMenuItem;
    readonly copyLinkMenuItem;
    readonly editMenuItem;
    readonly copyTextMenuItem;
    readonly deleteMenuItem;
    readonly flagMessageMenuItem;
    readonly showTranslationMenuItem;

    constructor(container: Locator) {
        super(container);

        this.replyMenuItem = container.getByRole('menuitem', {name: en['post_info.reply']});
        this.forwardMenuItem = container.getByRole('menuitem', {name: en['forward_post_button.label']});
        this.followMessageMenuItem = container.getByRole('menuitem', {name: en['threading.threadMenu.followMessage']});
        this.markAsUnreadMenuItem = container.getByRole('menuitem', {name: en['post_info.unread']});
        this.remindMenuItem = container.getByRole('menuitem', {name: en['post_info.post_reminder.menu']});
        this.saveMenuItem = container.getByRole('menuitem', {name: en['rhs_root.mobile.flag']});
        this.removeFromSavedMenuItem = container.getByRole('menuitem', {name: en['rhs_root.mobile.unflag']});
        this.pinToChannelMenuItem = container.getByRole('menuitem', {name: en['post_info.pin']});
        this.unpinFromChannelMenuItem = container.getByRole('menuitem', {name: en['post_info.unpin']});
        this.moveThreadMenuItem = container.getByRole('menuitem', {name: en['post_info.move_thread']});
        this.copyLinkMenuItem = container.getByRole('menuitem', {name: en['post_info.permalink']});
        this.editMenuItem = container.getByRole('menuitem', {name: en['post_info.edit']});
        this.copyTextMenuItem = container.getByRole('menuitem', {name: en['post_info.copy']});
        this.deleteMenuItem = container.getByRole('menuitem', {name: en['post_info.del']});
        this.flagMessageMenuItem = container.getByRole('menuitem', {name: en['post_info.quarantine']});
        this.showTranslationMenuItem = container.getByRole('menuitem', {name: en['post_info.show_translation']});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async flagMessageMenuItemNotToBeVisible() {
        await expect(this.flagMessageMenuItem).not.toBeVisible();
    }
}
