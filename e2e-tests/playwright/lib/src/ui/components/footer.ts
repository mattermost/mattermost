// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export default class Footer {
    readonly container: Locator;

    readonly copyright;
    readonly aboutLink;
    readonly privacyPolicyLink;
    readonly termsLink;
    readonly helpLink;

    constructor(container: Locator) {
        this.container = container;

        this.copyright = container.getByTestId('footer-copyright');
        this.aboutLink = container.getByText('About');
        this.privacyPolicyLink = container.getByText('Privacy Policy');
        this.termsLink = container.getByText('Terms');
        this.helpLink = container.getByText('Help');
    }

    async toBeVisible() {
        await expect(this.copyright).toBeVisible();
    }
}
