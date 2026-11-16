// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

/**
 * The channel attributes form the conversion and unarchive dialogs ask required
 * values with. Locators key off the attribute's machine name.
 */
export default class RequiredAttributesForm {
    readonly container: Locator;

    constructor(container: Locator) {
        this.container = container;
    }

    row(name: string): Locator {
        return this.container.getByTestId(`channelAttributeRow-${name}`);
    }

    field(name: string): Locator {
        return this.container.getByTestId(`channelAttribute-${name}`);
    }

    /**
     * Opens a select attribute's combobox and picks one of its options by its exact
     * label. The menu is portaled outside the dialog, so it is reached through the
     * input's aria-controls; the label span is matched rather than the option's
     * accessible name, so a name that is a substring of another can't match both.
     */
    async select(name: string, option: string) {
        const combobox = this.field(name);
        await combobox.click();
        await expect(combobox).toHaveAttribute('aria-expanded', 'true');
        const listboxId = await combobox.getAttribute('aria-controls');
        if (!listboxId) {
            throw new Error(`Attribute combobox "${name}" has no aria-controls`);
        }
        const listbox = this.container.page().locator(`#${listboxId}`);
        await listbox
            .getByRole('option')
            .filter({has: listbox.page().getByText(option, {exact: true})})
            .click();
        await expect(combobox).toHaveAttribute('aria-expanded', 'false');
        await expect(combobox).toHaveValue(option);
    }
}
