// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

/**
 * System Console -> System Attributes -> Membership Policies (policy list)
 *
 * The list is paginated (10 per page) and ordered by policy id, so a newly created
 * policy can land on any page. Search by name to bring a given policy into view.
 */
export default class MembershipPolicies {
    readonly container: Locator;
    readonly searchInput: Locator;

    constructor(container: Locator) {
        this.container = container.getByRole('region', {name: 'Membership Policies', exact: true});
        this.searchInput = this.container.getByRole('textbox', {name: 'Search'});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    policyName(name: string): Locator {
        return this.container.getByText(name, {exact: true});
    }

    async searchPolicy(name: string): Promise<Locator> {
        const page = this.container.page();
        await Promise.all([
            page.waitForResponse(
                (resp) =>
                    resp.url().endsWith('/api/v4/access_control_policies/search') && resp.request().method() === 'POST',
            ),
            this.searchInput.fill(name),
        ]);

        const policy = this.policyName(name);
        await expect(policy).toBeVisible();
        return policy;
    }
}
