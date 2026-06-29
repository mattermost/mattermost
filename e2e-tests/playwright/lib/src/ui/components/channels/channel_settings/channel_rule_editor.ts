// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';

/**
 * Rule editor panel inside the Permissions Policy tab of ChannelSettingsModal.
 * Opened by clicking the "Add rule" button; scoped to the editor panel
 * rendered at data-testid="permissions-policy-editor".
 */
export default class ChannelRuleEditor extends BaseComponent {
    readonly tabButton: Locator;
    readonly addRuleButton: Locator;
    readonly searchInput: Locator;
    readonly rulesTable: Locator;
    readonly editorPanel: Locator;
    readonly ruleInput: Locator;
    readonly expressionSection: Locator;
    readonly permissionsSection: Locator;
    readonly cancelButton: Locator;
    readonly saveButton: Locator;
    readonly errorMessage: Locator;

    constructor(container: Locator) {
        super(container);

        this.tabButton = container.getByTestId('permissions_policy-tab-button');
        this.addRuleButton = container.getByTestId('permissions-policy-add-rule');
        this.searchInput = container.getByTestId('permissions-policy-search');
        this.rulesTable = container.getByTestId('permissions-policy-rules-table');
        this.editorPanel = container.getByTestId('permissions-policy-editor');
        this.ruleInput = container.getByTestId('permissions-policy-editor-rule-name');
        this.expressionSection = container.getByTestId('permissions-policy-editor-expression-section');
        this.permissionsSection = container.getByTestId('permissions-policy-editor-permissions-section');
        this.cancelButton = container.getByTestId('permissions-policy-editor-cancel');
        this.saveButton = container.getByTestId('permissions-policy-editor-save');
        this.errorMessage = container.getByTestId('permissions-policy-editor-error');
    }

    async toBeVisible(): Promise<void> {
        await expect(this.editorPanel).toBeVisible();
    }
}
