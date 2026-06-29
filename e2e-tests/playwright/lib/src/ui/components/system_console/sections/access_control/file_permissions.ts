// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

import RuleBuilder from './rule_builder';

/**
 * System Console → System Attributes → Permission Policies → policy editor
 *
 * Wraps the PermissionPolicyDetails form used to create and edit
 * attribute-based file-permission policies (download_file_attachment,
 * upload_file_attachment).  The form contains a single shared attribute
 * rule builder that applies to all selected permissions; both
 * `downloadRuleBuilder` and `uploadRuleBuilder` wrap that same container
 * so callers can express intent clearly regardless of which permission
 * they are configuring.
 */
export default class FilePermissionsSection extends BaseComponent {
    readonly downloadRuleBuilder: RuleBuilder;
    readonly uploadRuleBuilder: RuleBuilder;
    readonly saveButton: Locator;

    constructor(container: Locator) {
        super(container);

        this.downloadRuleBuilder = new RuleBuilder(this.container);
        this.uploadRuleBuilder = new RuleBuilder(this.container);

        this.saveButton = this.container.getByRole('button', {
            name: en['admin.permission_policies.edit.save'],
        });
    }
}
