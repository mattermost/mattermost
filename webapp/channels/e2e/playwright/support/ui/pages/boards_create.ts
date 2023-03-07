// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator, Page} from '@playwright/test';

import {GlobalHeader} from '@e2e-support/ui/components';

export default class BoardsCreatePage {
    readonly boards = 'Boards';
    readonly page: Page;
    readonly globalHeader: GlobalHeader;
    readonly createBoardHeading: Locator;
    readonly createEmptyBoardButton: Locator;
    readonly useTemplateButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.globalHeader = new GlobalHeader(this.page.locator('#global-header'));
        this.createBoardHeading = page.getByRole('heading', {name: 'Create a board'});
        this.createEmptyBoardButton = page.getByRole('button', {name: ' Create an empty board'});
        this.useTemplateButton = page.getByRole('button', {name: 'Use this template'});
    }

    async goto(teamId = '') {
        let boardsUrl = '/boards';
        if (teamId) {
            boardsUrl += `/team/${teamId}`;
        }

        await this.page.goto(boardsUrl);
    }

    async toBeVisible() {
        await this.globalHeader.toBeVisible(this.boards);
        await expect(this.createEmptyBoardButton).toBeVisible();
        await expect(this.useTemplateButton).toBeVisible();
        await expect(this.createBoardHeading).toBeVisible();
    }

    async createEmptyBoard() {
        await this.createEmptyBoardButton.click();
    }
}

export {BoardsCreatePage};
