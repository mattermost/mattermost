// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

/**
 * System Console -> System Attributes -> Attribute-Based Access
 * URL: /admin_console/system_attributes/attribute_based_access_control
 *
 * Covers the system-wide ABAC enable/disable toggle and its save button.
 */
export default class AttributeBasedAccessControl extends BaseComponent {
    readonly enableRadio: Locator;
    readonly disableRadio: Locator;
    readonly saveButton: Locator;

    constructor(container: Locator) {
        super(container.getByTestId('sysconsole_section_AttributeBasedAccessControl'));

        this.enableRadio = this.container.locator('#AccessControlSettings\\.EnableAttributeBasedAccessControltrue');
        this.disableRadio = this.container.locator('#AccessControlSettings\\.EnableAttributeBasedAccessControlfalse');
        this.saveButton = this.container.getByRole('button', {name: en['save_button.save']});
    }

    async toBeVisible(): Promise<void> {
        await expect(this.container).toBeVisible();
    }
}
