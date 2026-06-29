// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';

/**
 * System Console -> Feature Discovery
 */
export default class FeatureDiscovery extends BaseComponent {
    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async toHaveTitle(title: string) {
        await expect(this.container.getByTestId('featureDiscovery_title')).toHaveText(title);
    }
}
