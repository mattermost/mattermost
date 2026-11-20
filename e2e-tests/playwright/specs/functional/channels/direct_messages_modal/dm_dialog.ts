// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';

import {Api, expect, waitForApi, type App} from '@mattermost/playwright-lib';

/** Opens the Direct Messages dialog from the sidebar's browse-or-add menu. */
export async function openDirectMessages(app: App): Promise<App['directMessagesModal']> {
    await app.lhs.header.openBrowseOrAddMenuButton.clickTo(app.lhs.browseOrAddMenu.openDirectMessageMenuItem);
    return app.lhs.browseOrAddMenu.openDirectMessageMenuItem.clickTo(app.directMessagesModal);
}

/** Searches the dialog for a user and adds them to the selection. */
export async function selectUser(app: App, user: Pick<UserProfile, 'id' | 'username'>) {
    const options = app.directMessagesModal.options;
    await Promise.all([
        waitForApi(app.page, Api.SearchUsers, {
            predicate: (_, response) => response.request().postDataJSON()?.term === user.username,
        }),
        options.searchCombobox.fill(user.username),
    ]);
    // A user suggestion is exposed as a role-free row; choosing it requires its scoped locator.
    await options.user(user).container.click();
    await expect(options.remove(user.id)).toBeVisible();
}

/** Opens the conversation with the selected users and waits for the dialog to close. */
export async function goToChannel(app: App) {
    await app.directMessagesModal.options.saveButton.click();
    await expect(app.directMessagesModal).not.toBeVisible();
}
