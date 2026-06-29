// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import type {BaseComponent} from './base_component';

export abstract class BasePage {
    readonly page: Page;

    abstract readonly components: Record<string, BaseComponent>;

    constructor(page: Page) {
        this.page = page;
    }

    async toBeVisible(): Promise<void> {
        // Concrete pages override this to call their primary component's toBeVisible()
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async goto(..._args: unknown[]): Promise<void> {
        // Concrete pages that are navigable implement this
    }
}
