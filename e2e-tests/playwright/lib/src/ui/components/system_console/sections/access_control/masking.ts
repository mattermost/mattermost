// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {type Locator} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

export default class MaskingSection extends BaseComponent {
    readonly maskedChips: Locator;
    readonly restrictedValuesBanner: Locator;
    readonly deletePolicyMaskedValuesWarning: Locator;
    readonly celMaskedValuesBanner: Locator;

    readonly simpleButton: Locator;
    readonly advancedButton: Locator;
    readonly saveButton: Locator;
    readonly testAccessRuleButton: Locator;
    readonly addAttributeButton: Locator;

    readonly tableEditorRows: Locator;

    readonly monacoEditorDiv: Locator;
    readonly monacoEditorLines: Locator;
    readonly monacoEditorInput: Locator;

    constructor(container: Locator) {
        super(container);

        this.maskedChips = this.container.locator(
            '[aria-label="' + en['admin.access_control.masked_chip.aria_label'] + '"]',
        );
        this.restrictedValuesBanner = this.container.getByText(
            en['admin.access_control.policy.edit_policy.masked_values_warning.title'],
        );
        this.deletePolicyMaskedValuesWarning = this.container.getByText(
            en['admin.access_control.policy.edit_policy.delete_policy.masked_values_warning.title'],
        );
        this.celMaskedValuesBanner = this.container.getByText(en['admin.access_control.cel.masked_values_banner']);

        this.simpleButton = this.container.getByRole('button', {
            name: en['admin.access_control.policy.edit_policy.switch_to_simple'],
        });
        this.advancedButton = this.container.getByRole('button', {
            name: en['admin.access_control.policy.edit_policy.switch_to_advanced'],
        });
        this.saveButton = this.container.getByRole('button', {name: en['admin.access_control.edit_policy.save']});
        this.testAccessRuleButton = this.container.getByRole('button', {
            name: en['admin.access_control.table_editor.test_access_rule'],
        });
        this.addAttributeButton = this.container.getByRole('button', {
            name: en['admin.access_control.table_editor.add_attribute'],
        });

        this.tableEditorRows = this.container.getByTestId(/^tableEditorRow-/);

        const celEditorInput = this.container.getByTestId('celEditorInput');
        this.monacoEditorDiv = celEditorInput.locator('[class*="monaco-editor"]').first();
        this.monacoEditorLines = celEditorInput.locator('[class*="view-lines"]').first();
        this.monacoEditorInput = celEditorInput.locator('textarea[class*="inputarea"]').first();
    }

    tableEditorRow(nth: number): Locator {
        return this.container.getByTestId(`tableEditorRow-${nth}`);
    }

    getRemoveRowButton(nth: number): Locator {
        return this.tableEditorRow(nth).getByRole('button', {
            name: en['admin.access_control.table_editor.remove_row'],
        });
    }

    visibilityToggle(nth: number): Locator {
        return this.tableEditorRow(nth).getByRole('checkbox');
    }
}
