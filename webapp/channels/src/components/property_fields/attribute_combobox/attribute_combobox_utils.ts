// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {KeyboardEvent, MouseEvent} from 'react';

import type {ComboboxOption} from '@mattermost/compass-ui/components/combobox';
import type {PropertyFieldOption} from '@mattermost/types/properties';

export function toComboboxOptions(options: readonly PropertyFieldOption[] | undefined, testIdPrefix?: string): ComboboxOption[] {
    if (!options) {
        return [];
    }

    return options.map((option) => {
        const comboboxOption: ComboboxOption = {value: option.id, label: option.name};
        if (testIdPrefix) {
            comboboxOption.menuItemProps = {'data-testid': `${testIdPrefix}-option-${option.id}`};
        }
        return comboboxOption;
    });
}

// Combobox calls preventDefault() on the Enter and Escape presses it handles
// (picking an option, closing the menu). Stopping those here keeps them from
// reaching document listeners that would otherwise submit a form or close the
// surrounding modal.
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

// Marks a wrapper whose Combobox must not take SettingItemMax's initial focus:
// Combobox opens its menu whenever its input gains focus.
export const ATTRIBUTE_COMBOBOX_WRAPPER_ATTRIBUTE = 'data-attribute-combobox';

type AttributeComboboxWrapperProps = {
    [ATTRIBUTE_COMBOBOX_WRAPPER_ATTRIBUTE]: '';
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
    onMouseDown: (e: MouseEvent<HTMLElement>) => void;
};

// Spread on the element that wraps only the Combobox. Both guards are needed:
// without the mousedown guard, focus can leave the input and the key guard
// stops seeing Escape.
export function getAttributeComboboxWrapperProps(): AttributeComboboxWrapperProps {
    return {
        [ATTRIBUTE_COMBOBOX_WRAPPER_ATTRIBUTE]: '',
        onKeyDown: attributeComboboxKeyGuard,
        onMouseDown: attributeComboboxMouseDownGuard,
    };
}

type AttributeComboboxClearButtonProps = {
    'data-testid'?: string;
    onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
};

// Combobox doesn't preventDefault() Enter on its clear button, so the key guard
// can't tell it apart from Enter on a closed field. Never preventDefault() here,
// or the button would stop activating.
export function getAttributeComboboxClearButtonProps(testId?: string): AttributeComboboxClearButtonProps {
    return {
        'data-testid': testId,
        onKeyDown: (e) => {
            if (e.key === 'Enter') {
                e.stopPropagation();
            }
        },
    };
}
