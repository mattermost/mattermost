// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

/**
 * The single-group view modal, shown after opening a group from the User Groups list.
 */
export default class ViewUserGroupModal {
    readonly container: Locator;

    readonly actionsButton;
    readonly archiveGroupItem;
    readonly restoreGroupButton;
    readonly addPeopleButton;

    constructor(container: Locator) {
        this.container = container;

        this.actionsButton = container.getByRole('button', {name: 'User group actions'});
        this.restoreGroupButton = container.getByRole('button', {name: 'Restore Group'});
        this.addPeopleButton = container.getByRole('button', {name: 'Add people'});

        // The group actions menu renders in a portal outside the modal.
        this.archiveGroupItem = container.page().getByRole('menuitem', {name: 'Archive Group'});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async archive() {
        await this.actionsButton.click();
        await this.archiveGroupItem.click();
    }

    async restore() {
        await this.restoreGroupButton.click();
    }
}
