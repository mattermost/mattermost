// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

/**
 * Permission Policy create/edit form in System Console > Permission Policies.
 * Covers the form UI elements and inline validation for permission policies
 * (distinct from the membership policy PolicyEditor).
 */
export default class PermissionPolicyForm extends BaseComponent {
    readonly nameInput: Locator;
    readonly saveButton: Locator;
    readonly cancelButton: Locator;
    readonly switchToAdvancedButton: Locator;
    readonly switchToSimpleButton: Locator;

    // Info banner
    readonly infoBannerTitle: Locator;
    readonly infoBannerSystemPermissionSchemesLink: Locator;
    readonly infoBannerEvaluationOrder: Locator;

    // Who section
    readonly whoSectionTitle: Locator;
    readonly roleSelectorButton: Locator;

    // CEL editor (advanced mode)
    readonly celEditorInput: Locator;
    readonly monacoEditorDiv: Locator;
    readonly monacoEditorLines: Locator;

    // Validation errors
    readonly nameRequiredError: Locator;
    readonly expressionRequiredError: Locator;
    readonly permissionsRequiredError: Locator;

    constructor(container: Locator) {
        super(container);

        this.nameInput = this.container.getByPlaceholder(en['admin.permission_policies.edit.policyName.placeholder']);
        this.saveButton = this.container.getByRole('button', {
            name: en['admin.permission_policies.edit.save'],
        });
        this.cancelButton = this.container.getByRole('button', {
            name: en['admin.permission_policies.edit.cancel'],
        });
        this.switchToAdvancedButton = this.container.getByRole('button', {
            name: en['admin.permission_policies.edit.switch_to_advanced'],
        });
        this.switchToSimpleButton = this.container.getByRole('button', {
            name: en['admin.permission_policies.edit.switch_to_simple'],
        });

        // Info banner
        this.infoBannerTitle = this.container.getByText(
            en['admin.permission_policies.edit.info_banner.title'].replace(' {link}', ''),
            {exact: false},
        );
        this.infoBannerSystemPermissionSchemesLink = this.container.getByText(
            en['admin.permission_policies.edit.info_banner.link'],
            {exact: false},
        );
        this.infoBannerEvaluationOrder = this.container.getByText(
            en['admin.permission_policies.edit.info_banner.evaluation_order'].replace(
                / Permissions evaluation order:.*/,
                'Permissions evaluation order',
            ),
            {exact: false},
        );

        // Who section
        this.whoSectionTitle = this.container.getByText(en['admin.permission_policies.edit.who.title'], {exact: true});
        this.roleSelectorButton = this.container.locator('#pp-role-selector-btn');

        // CEL editor (advanced mode)
        this.celEditorInput = this.container.getByTestId('celEditorInput');
        this.monacoEditorDiv = this.celEditorInput.locator('[class*="monaco-editor"]').first();
        this.monacoEditorLines = this.celEditorInput.locator('[class*="view-lines"]').first();

        // Validation errors
        this.nameRequiredError = this.container.getByText(en['admin.permission_policies.edit.error.name_required'], {
            exact: true,
        });
        this.expressionRequiredError = this.container.getByText(
            en['admin.permission_policies.edit.error.expression_required'],
            {exact: true},
        );
        this.permissionsRequiredError = this.container.getByText(
            en['admin.permission_policies.edit.error.permissions_required'],
            {exact: true},
        );
    }

    /**
     * Returns the locator for a role option in the role dropdown by role ID.
     * e.g. getRoleOption('system_admin') => #pp-role-option-system_admin
     */
    getRoleOption(roleId: string): Locator {
        return this.container.locator(`#pp-role-option-${roleId}`);
    }

    /**
     * Returns the "Add permission" button that opens the permissions picker menu.
     */
    getPermissionMenuButton(): Locator {
        return this.container.locator('#pp-add-permission-btn');
    }

    /**
     * Returns a specific permission option in the add-permission menu by action ID.
     */
    getPermissionOption(actionId: string): Locator {
        return this.container.locator(`#pp-add-permission-${actionId}`);
    }

    /**
     * Returns the operator selector for a rule row at the given index.
     */
    getOperatorSelector(index = 0): Locator {
        return this.container.getByTestId('operatorSelectorMenuButton').nth(index);
    }

    /**
     * Returns the attribute picker button for a rule row at the given index.
     */
    getAttributePicker(index = 0): Locator {
        return this.container.getByTestId('attributeSelectorMenuButton').nth(index);
    }

    async toBeVisible(): Promise<void> {
        await expect(this.container).toBeVisible();
    }

    async switchToAdvancedMode(): Promise<void> {
        await expect(this.switchToAdvancedButton).toBeEnabled({timeout: 60_000});
        await this.switchToAdvancedButton.click();
    }

    async switchToSimpleMode(): Promise<void> {
        await expect(this.switchToSimpleButton).toBeEnabled({timeout: 60_000});
        await this.switchToSimpleButton.click();
    }

    async enterCelExpression(expr: string): Promise<void> {
        const editorLines = this.monacoEditorLines;
        await editorLines.click({force: true});
        const isMac = process.platform === 'darwin';
        await this.container.page().keyboard.press(isMac ? 'Meta+a' : 'Control+a');
        await this.container.page().keyboard.type(expr, {delay: 10});
    }
}
