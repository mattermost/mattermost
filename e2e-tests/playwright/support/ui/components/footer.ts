// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

export default class Footer {
    readonly container: Locator;

    readonly copyright;
    readonly aboutLink;
    readonly privacyPolicyLink;
    readonly termsLink;
    readonly helpLink;

    constructor(container: Locator) {
        this.container = container;

        this.copyright = container.locator('.footer-copyright');
        this.aboutLink = container.locator('text=About');
        this.privacyPolicyLink = container.locator('text=Privacy Policy');
        this.termsLink = container.locator('text=Terms');
        this.helpLink = container.locator('text=Help');
    }

    async toBeVisible() {
        await expect(this.copyright).toBeVisible();
    }
}

export {Footer};
