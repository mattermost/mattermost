// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

/**
 * System Console — User Management > Teams > [Team Detail]
 * Covers the team membership-mode panel (policy enforce toggle) and the
 * ABAC membership-policy assignment panel.
 */
export default class TeamDirectorySection extends BaseComponent {
    readonly saveButton: Locator;

    constructor(container: Locator) {
        super(container);
        this.saveButton = container.page().getByTestId('saveSetting');
    }

    /**
     * The "Manage membership with attribute based membership policies" toggle
     * rendered by the PolicyEnforceToggle (LineSwitch id="policy-enforce-toggle").
     */
    get visibilityToggle(): Locator {
        return this.container.getByTestId('policy-enforce-toggle');
    }

    /**
     * The heading of the ABAC membership-policy assignment panel
     * ("Membership policy"). Use this to assert that the panel is rendered
     * and to scope further queries within it.
     */
    get abacRulesSection(): Locator {
        return this.container.getByRole('heading', {
            name: en['admin.team_settings.team_detail.access_control_policy_title'],
        });
    }
}
