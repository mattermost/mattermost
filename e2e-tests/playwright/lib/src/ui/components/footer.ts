// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

export default class Footer extends BaseComponent {
    readonly copyright;
    readonly aboutLink;
    readonly privacyPolicyLink;
    readonly termsLink;
    readonly helpLink;

    constructor(container: Locator) {
        super(container);

        this.copyright = container.getByTestId('footerCopyright');
        this.aboutLink = container.getByRole('link', {name: en['web.footer.about']});
        this.privacyPolicyLink = container.getByRole('link', {name: en['web.footer.privacy']});
        this.termsLink = container.getByRole('link', {name: en['web.footer.terms']});
        this.helpLink = container.getByRole('link', {name: en['web.footer.help']});
    }

    async toBeVisible() {
        await expect(this.copyright).toBeVisible();
    }
}
