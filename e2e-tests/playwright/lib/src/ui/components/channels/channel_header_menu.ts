// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator, Page} from '@playwright/test';
import {expect} from '@playwright/test';

export default class ChannelHeaderMenu {
    readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    get container() {
        return this.page.getByRole('menu').filter({
            has: this.page.getByRole('menuitem', {name: /Auto-translation|Channel Settings|Edit Header/}),
        });
    }

    get disableAutotranslation() {
        return this.page.getByRole('menuitem', {name: 'Disable autotranslation'});
    }

    get enableAutotranslation() {
        return this.page.getByRole('menuitem', {name: 'Enable autotranslation'});
    }

    get editHeader() {
        return this.page.getByRole('menuitem', {name: 'Edit Header'});
    }

    get channelSettings() {
        return this.page.getByRole('menuitem', {name: 'Channel Settings'});
    }

    get autotranslationSubmenu() {
        return this.page.getByRole('menuitem', {name: /Auto-translation/});
    }

    get turnOffAutotranslationButton() {
        return this.page.getByRole('button', {name: 'Turn off auto-translation'});
    }
}

export class ShowTranslationModal {
    readonly container: Locator;

    constructor(page: Page) {
        this.container = page.getByRole('dialog').filter({hasText: 'Show Translation'});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }
}
