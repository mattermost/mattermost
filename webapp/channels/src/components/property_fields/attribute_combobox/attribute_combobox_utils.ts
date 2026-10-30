// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {KeyboardEvent, MouseEvent} from 'react';

import type {ComboboxOption} from '@mattermost/compass-ui/components/combobox';
import type {PropertyFieldOption} from '@mattermost/types/properties';

export function toComboboxOptions(options: readonly PropertyFieldOption[], testIdPrefix?: string): ComboboxOption[] {
    return options.map((option) => {
        const comboboxOption: ComboboxOption = {value: option.id, label: option.name};
        if (testIdPrefix) {
            comboboxOption.menuItemProps = {'data-testid': `${testIdPrefix}-option-${option.id}`};
        }
        return comboboxOption;
    });
}

// Stops any Enter or Escape whose default was prevented: by Combobox (picking an
// option, closing the menu) or by enterSubmitGuard. This keeps them from reaching
// document listeners that would otherwise submit a form or close the surrounding
// modal.
export function attributeComboboxKeyGuard(e: KeyboardEvent<HTMLElement>): void {
    if ((e.key === 'Enter' || e.key === 'Escape') && e.defaultPrevented) {
        e.stopPropagation();
    }
}

// Combobox portals its menu out of this wrapper's DOM and only keeps focus on
// the input for mousedowns on option rows. A mousedown elsewhere in the menu
// (scrollbar, padding) would move focus off the input while the menu stays
// open, so the next Escape would bypass the key guard and close the modal.
// React still delivers portal events here, so prevent the focus move.
// Wrap only the Combobox: any other portaled content under this wrapper also
// loses mousedown focus.
export function attributeComboboxMouseDownGuard(e: MouseEvent<HTMLElement>): void {
    if (!e.currentTarget.contains(e.target as Node)) {
        e.preventDefault();
    }
}

// Combobox doesn't preventDefault() Enter on its clear button, so the key guard
// can't tell it apart from Enter on a closed field. Never preventDefault() here,
// or the button would stop activating.
export function clearButtonKeyGuard(e: KeyboardEvent<HTMLButtonElement>): void {
    if (e.key === 'Enter') {
        e.stopPropagation();
    }
}

// Combobox only prevents the Enter that picks an option. Any other Enter on the
// input (menu closed, or no matching rows) would implicitly submit a surrounding
// form. An Enter that commits IME composition must stay untouched.
export function enterSubmitGuard(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
        e.preventDefault();
    }
}
