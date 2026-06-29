// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

import RuleBuilder from './rule_builder';

export default class PolicyEditor extends BaseComponent {
    readonly ruleBuilder: RuleBuilder;

    readonly policyNameInput: Locator;
    readonly celEditorInput: Locator;
    readonly celEditorStatusBar: Locator;
    readonly validIndicator: Locator;
    readonly saveButton: Locator;
    readonly cancelButton: Locator;
    readonly advancedModeButton: Locator;
    readonly testAccessRuleButton: Locator;
    readonly addAttributeButton: Locator;
    readonly addChannelsButton: Locator;
    readonly applyPolicyButton: Locator;
    readonly addPolicyButton: Locator;

    // Monaco editor (CEL advanced mode)
    readonly monacoEditor: Locator;
    readonly monacoEditorDiv: Locator;
    readonly monacoEditorLines: Locator;
    readonly monacoEditorInput: Locator;

    // Masking
    readonly maskedChips: Locator;
    readonly restrictedValuesBanner: Locator;

    // Table editor
    readonly tableEditorRows: Locator;

    // Status / error
    readonly errorMessage: Locator;
    readonly saveError: Locator;
    readonly celValidText: Locator;

    // Table editor remove buttons
    readonly tableEditorRemoveButtons: Locator;

    // Channel picker modal (opened by addChannelsButton)
    readonly channelPickerInput: Locator;

    // Page heading
    readonly pageHeading: Locator;

    // Integration
    readonly policyEnforceToggle: Locator;
    readonly linkToPolicyButton: Locator;

    constructor(container: Locator) {
        super(container);

        this.policyNameInput = this.container.locator('#admin\\.access_control\\.policy\\.edit_policy\\.policyName');
        this.celEditorInput = this.container.getByTestId('celEditorInput');
        this.celEditorStatusBar = this.container.getByTestId('celEditorStatusBar');
        this.validIndicator = this.container.locator(
            '[data-testid="celEditorStatusBar"][data-validation-state="validated"]',
        );
        this.saveButton = this.container.getByRole('button', {name: en['admin.access_control.edit_policy.save']});
        this.cancelButton = this.container.getByRole('button', {name: en['admin.access_control.edit_policy.cancel']});
        this.advancedModeButton = this.container.getByRole('button', {
            name: en['admin.access_control.policy.edit_policy.switch_to_advanced'],
        });
        this.testAccessRuleButton = this.container.getByRole('button', {
            name: en['admin.access_control.table_editor.test_access_rule'],
        });
        this.addAttributeButton = this.container.getByRole('button', {
            name: en['admin.access_control.table_editor.add_attribute'],
        });
        this.addChannelsButton = this.container.getByRole('button', {
            name: en['admin.access_control.policy.edit_policy.channel_selector.addChannels'],
        });
        this.applyPolicyButton = this.container.getByRole('button', {
            name: en['admin.access_control.edit_policy.apply_policy'],
        });
        this.addPolicyButton = this.container.getByRole('button', {
            name: en['admin.access_control.policies.add_policy'],
        });

        // Monaco editor (CEL advanced mode) — the wrapper div has data-testid='celEditorInput'
        this.monacoEditor = this.container.getByTestId('celEditorInput');
        // The inner div.monaco-editor rendered by Monaco (has aria-readonly when read-only)
        this.monacoEditorDiv = this.celEditorInput.locator('[class*="monaco-editor"]').first();
        this.monacoEditorLines = this.celEditorInput.locator('[class*="view-lines"]').first();
        this.monacoEditorInput = this.celEditorInput.locator('textarea[class*="inputarea"]').first();

        // Masking
        this.maskedChips = this.container.locator('[class*="select__multi-value--masked"]');
        this.restrictedValuesBanner = this.container.locator('text="This policy contains restricted values"');

        // Table editor
        this.tableEditorRows = this.container.locator('[class*="table-editor__row"]');

        // Status / error
        this.errorMessage = this.container.getByTestId('editPolicyError');
        this.saveError = this.container.locator('text=/Unable to save|errors in the form/i');
        this.celValidText = this.container.locator('text=Valid');

        // Table editor remove buttons (aria-label used by remove-row action buttons)
        this.tableEditorRemoveButtons = this.container.getByRole('button', {
            name: en['admin.access_control.table_editor.remove_row'],
        });

        // Channel picker modal (opened by addChannelsButton)
        this.channelPickerInput = this.container.page().getByTestId('searchInput');

        // Page heading
        this.pageHeading = this.container.getByText(en['admin.permission_policies.edit.title'], {exact: true});

        // Integration
        this.policyEnforceToggle = this.container.getByTestId('policy-enforce-toggle-button');
        this.linkToPolicyButton = this.container.getByTestId('link-to-a-policy');

        this.ruleBuilder = new RuleBuilder(this.container);
    }

    getRoleSelectorButton(): Locator {
        return this.container.locator('#pp-role-selector-btn');
    }

    getRoleOption(role: string): Locator {
        return this.container.locator(`#pp-role-option-${role}`);
    }

    getPermissionMenuButton(): Locator {
        return this.container.locator('#pp-add-permission-btn');
    }

    getPermissionOption(actionId: string): Locator {
        return this.container.locator(`#pp-add-permission-${actionId}`);
    }

    getUniqueNamePlaceholder(): Locator {
        return this.container.getByPlaceholder('Add a unique policy name');
    }

    getAutoAddHeaderCheckbox(): Locator {
        return this.container.locator('#auto-add-header-checkbox');
    }

    async toBeVisible(): Promise<void> {
        await expect(this.container).toBeVisible();
    }

    async switchToAdvancedMode(): Promise<void> {
        await expect(this.advancedModeButton).toBeEnabled({timeout: 60_000});
        await this.advancedModeButton.click();
    }

    async enterCelExpression(expr: string): Promise<void> {
        const editorLines = this.celEditorInput.locator('[class*="view-lines"]');
        await editorLines.click({force: true});
        const isMac = process.platform === 'darwin';
        await this.container.page().keyboard.press(isMac ? 'Meta+a' : 'Control+a');
        await this.container.page().keyboard.type(expr, {delay: 10});
    }

    async waitForValidCelExpression(timeoutMs = 10_000): Promise<void> {
        await expect(this.celEditorStatusBar).toHaveAttribute('data-validation-state', 'validated', {
            timeout: timeoutMs,
        });
    }

    getMultiValueChip(text: string): Locator {
        return this.container.locator('[class*="select__multi-value"]').filter({hasText: text});
    }

    getChipRemoveButton(chip: Locator): Locator {
        return chip.locator('[class*="select__multi-value__remove"]');
    }

    get ruleOperatorSelector(): Locator {
        return this.ruleBuilder.operatorSelectorMenu;
    }
}
