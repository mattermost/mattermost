// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {KeyboardEvent, MouseEvent} from 'react';

import type {ComboboxOption} from '@mattermost/compass-ui/components/combobox';
import type {PropertyFieldOption} from '@mattermost/types/properties';

// Matches --z-index-menu: above modals (1050), below popovers and tooltips (1200).
export const ATTRIBUTE_COMBOBOX_MODAL_Z_INDEX = 1100;

export type ToComboboxOptionsConfig = {
    testIdPrefix?: string;
};

export function toComboboxOptions(options: readonly PropertyFieldOption[] | undefined, config: ToComboboxOptionsConfig = {}): ComboboxOption[] {
    if (!options) {
        return [];
    }

    const {testIdPrefix} = config;
    return options.map((option) => {
        const comboboxOption: ComboboxOption = {value: option.id, label: option.name};
        if (testIdPrefix) {
            comboboxOption.menuItemProps = {'data-testid': `${testIdPrefix}-option-${option.id}`};
        }
        return comboboxOption;
    });
}

export function toComboboxSingleValue(value: string | string[] | null | undefined): string {
    return typeof value === 'string' ? value : '';
}

export function toComboboxMultiValue(value: string | string[] | null | undefined): string[] {
    if (Array.isArray(value)) {
        return value.filter((item) => typeof item === 'string');
    }
    return value ? [value] : [];
}

export function fromComboboxSingleChange(next: string | string[] | null): string {
    if (Array.isArray(next)) {
        return next[0] ?? '';
    }
    return next ?? '';
}

export function fromComboboxMultiChange(next: string | string[] | null): string[] {
    if (Array.isArray(next)) {
        return next;
    }
    return next ? [next] : [];
}

// Selected values whose option was deleted still need a chip, so they are
// returned as options of their own, in value order and without duplicates.
export function getFallbackSelectedOptions(
    values: readonly string[],
    options: readonly ComboboxOption[],
    getFallbackLabel: (value: string) => string = (value) => value,
): ComboboxOption[] {
    const known = new Set(options.map((option) => option.value));
    const seen = new Set<string>();
    const fallbacks: ComboboxOption[] = [];

    for (const value of values) {
        if (known.has(value) || seen.has(value)) {
            continue;
        }
        seen.add(value);
        fallbacks.push({value, label: getFallbackLabel(value)});
    }

    return fallbacks;
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

export type AttributeComboboxWrapperProps = {
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
    onMouseDown: (e: MouseEvent<HTMLElement>) => void;
};

// Spread on the element that wraps only the Combobox. Both guards are needed:
// without the mousedown guard, focus can leave the input and the key guard
// stops seeing Escape.
export function getAttributeComboboxWrapperProps(): AttributeComboboxWrapperProps {
    return {
        onKeyDown: attributeComboboxKeyGuard,
        onMouseDown: attributeComboboxMouseDownGuard,
    };
}

export type AttributeComboboxClearButtonProps = {
    'data-testid': string;
    onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
};

// Combobox doesn't preventDefault() Enter on its clear button, so the key guard
// can't tell it apart from Enter on a closed field. Never preventDefault() here,
// or the button would stop activating.
export function getAttributeComboboxClearButtonProps(testId: string): AttributeComboboxClearButtonProps {
    return {
        'data-testid': testId,
        onKeyDown: (e) => {
            if (e.key === 'Enter') {
                e.stopPropagation();
            }
        },
    };
}
