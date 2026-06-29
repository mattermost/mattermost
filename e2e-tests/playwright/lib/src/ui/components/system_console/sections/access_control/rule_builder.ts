// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';

export default class RuleBuilder extends BaseComponent {
    readonly valuesEditorInput: Locator;
    readonly autoAddHeaderCheckbox: Locator;
    readonly attributeSelectorMenu: Locator;
    readonly operatorSelectorMenu: Locator;
    readonly valueSelectorMenu: Locator;
    readonly simpleValueInput: Locator;
    readonly valueMenuSearchInput: Locator;

    constructor(container: Locator) {
        super(container);

        this.valuesEditorInput = container.getByTestId('valuesEditorInput');
        this.autoAddHeaderCheckbox = container.locator('#auto-add-header-checkbox');
        this.attributeSelectorMenu = container.locator('[id^="attribute-selector-menu"]');
        this.operatorSelectorMenu = container.locator('[id^="operator-selector-menu"]');
        this.valueSelectorMenu = container.locator('[id^="value-selector-menu"]');
        this.simpleValueInput = container.getByTestId('valuesEditorInput');
        this.valueMenuSearchInput = this.valueSelectorMenu.locator('input[type="text"]');
    }

    getAttributeSelectorButton(index = 0): Locator {
        return this.container.getByTestId('attributeSelectorMenuButton').nth(index);
    }

    getOperatorSelectorButton(index = 0): Locator {
        return this.container.getByTestId('operatorSelectorMenuButton').nth(index);
    }

    getValueSelectorButton(index = 0): Locator {
        return this.container.getByTestId('valueSelectorMenuButton').nth(index);
    }

    getAttributeMenuItemByText(text: string): Locator {
        return this.container.locator('[id^="attribute-selector-menu"] li').filter({hasText: text});
    }

    getOperatorMenuItemByText(text: string): Locator {
        return this.container.locator('[id^="operator-selector-menu"] li').filter({hasText: text});
    }

    getValueMenuItemByText(text: string): Locator {
        return this.container.locator('[id^="value-selector-menu"] li').filter({hasText: text});
    }

    getValueEditorInput(index = 0): Locator {
        return this.container.getByTestId('valuesEditorInput').nth(index);
    }

    getAttributeSelectorSearchInput(): Locator {
        return this.container.locator('[class*="attribute-selector-search"] input');
    }

    getSimpleValueInputByIndex(index = 0): Locator {
        return this.container.getByTestId('valuesEditorInput').nth(index);
    }
}
