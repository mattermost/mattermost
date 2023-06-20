// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator} from '@playwright/test';

export default class BoardsSidebar {
    readonly container: Locator;

    readonly plusButton;
    readonly createNewBoardMenuItem;
    readonly createNewCategoryMenuItem;
    readonly titles;

    constructor(container: Locator) {
        this.container = container;

        this.plusButton = container.locator('.add-board-icon');
        this.createNewBoardMenuItem = container.getByRole('button', {name: 'Create new board'});
        this.createNewCategoryMenuItem = container.getByRole('button', {name: 'Create New Category'});
        this.titles = container.locator('.SidebarBoardItem > .octo-sidebar-title');
    }

    async waitForTitle(name: string) {
        await this.container.getByRole('button', {name: ` ${name}`}).waitFor({state: 'visible'});
    }
}

export {BoardsSidebar};
