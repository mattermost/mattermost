// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

/**
 * System Console -> About -> Edition and License
 */
export default class EditionAndLicense {
    readonly container: Locator;
    readonly header: Locator;
    readonly privacyPolicyLink: Locator;
    readonly termsOfServiceLink: Locator;

    constructor(container: Locator) {
        this.container = container;
        this.header = container.getByText('Edition and License', {exact: true});
        this.privacyPolicyLink = container.getByRole('link', {name: 'Privacy Policy'});
        this.termsOfServiceLink = container.getByRole('link', {name: 'Enterprise Edition Terms of Use'});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await expect(this.header).toBeVisible();
    }
}
