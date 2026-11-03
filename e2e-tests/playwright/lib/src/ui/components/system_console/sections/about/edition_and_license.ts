// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

/**
 * System Console -> About -> Edition and License.
 *
 * Use AboutBuildModal for the server version string.
 */
export default class EditionAndLicense {
    readonly container: Locator;
    readonly header: Locator;
    readonly enterprisePanel: Locator;

    constructor(container: Locator) {
        this.container = container;
        this.header = container.getByText('Edition and License', {exact: true});
        this.enterprisePanel = container.getByTestId('EnterpriseEditionLeftPanel');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await expect(this.header).toBeVisible();
    }

    /** Confirms the edition/license body rendered (licensed EE panel, or any edition left panel). */
    async toHaveLicensePanel() {
        const editionBody = this.container.locator(
            '[data-testid="EnterpriseEditionLeftPanel"], .TeamEditionLeftPanel, .StarterLeftPanel, .EnterpriseEditionLeftPanel',
        );
        await expect(editionBody.first()).toBeVisible();
    }
}
