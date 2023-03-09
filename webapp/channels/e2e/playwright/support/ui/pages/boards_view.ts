// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator, Page} from '@playwright/test';

import {BoardsSidebar, GlobalHeader} from '@e2e-support/ui/components';

export default class BoardsViewPage {
    readonly boards = 'Boards';
    readonly page: Page;
    readonly sidebar: BoardsSidebar;
    readonly globalHeader: GlobalHeader;
    readonly topHead: Locator;
    readonly editableTitle: Locator;
    readonly shareButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.sidebar = new BoardsSidebar(page.locator('.octo-sidebar'));
        this.globalHeader = new GlobalHeader(this.page.locator('#global-header'));
        this.topHead = page.locator('.top-head');
        this.editableTitle = this.topHead.getByPlaceholder('Untitled board');
        this.shareButton = page.getByRole('button', {name: '󰍁 Share'});
    }

    async goto(teamId = '', boardId = '', viewId = '', cardId = '') {
        let boardsUrl = '/boards';
        if (teamId) {
            boardsUrl += `/team/${teamId}`;
            if (boardId) {
                boardsUrl += `/${boardId}`;
                if (viewId) {
                    boardsUrl += `/${viewId}`;
                    if (cardId) {
                        boardsUrl += `/${cardId}`;
                    }
                }
            }
        }

        await this.page.goto(boardsUrl);
    }

    async toBeVisible() {
        await this.page.waitForLoadState('networkidle');
        await this.globalHeader.toBeVisible(this.boards);
        await expect(this.shareButton).toBeVisible();
        await expect(this.topHead).toBeVisible();
    }

    async shouldHaveUntitledBoard() {
        await this.editableTitle.isVisible();
        expect(await this.editableTitle.getAttribute('value')).toBe('');
        await expect(this.page.getByTitle('(Untitled Board)')).toBeVisible();
    }
}

export {BoardsViewPage};
