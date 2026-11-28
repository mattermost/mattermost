// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api} from '@/ui/generated';
import type {App} from '@/ui/generated';
import {settle} from '@/aria/settle';
import {expect} from '@/aria/matchers';

/** Opens the "Create new channel" modal from the sidebar's browse-or-add menu. */
export async function openNewChannelModal(app: App) {
    await app.lhs.header.openBrowseOrAddMenuButton.click();
    await expect(app.lhs.browseOrAddMenu.createChannelMenuItem).toBeVisible();
    return app.lhs.browseOrAddMenu.createChannelMenuItem.clickTo(app.newChannelModal);
}

/** Creates a public (`'O'`) or private (`'P'`) channel through the modal and waits for the server to create it. */
export async function createChannelFromModal(app: App, name: string, type: 'O' | 'P' = 'O') {
    const modal = await openNewChannelModal(app);
    await modal.name.container.fill(name);
    await expect(modal.name.container).toHaveValue(name);
    const typeButton = type === 'P' ? modal.type.privateButton : modal.type.publicButton;
    await typeButton.click();
    await expect(typeButton.locator).toHaveClass(/\bselected\b/);
    return settle(modal.confirmButton, {wait: Api.CreateChannel}).click();
}
