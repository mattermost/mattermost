// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {StylesConfig} from 'react-select';

import type {MmSelectInputBlock, MmSelectOptionGroup, MmStaticSelectOption} from '@mattermost/types/mm_blocks';

import type GenericChannelProvider from 'components/suggestion/generic_channel_provider';
import type GenericUserProvider from 'components/suggestion/generic_user_provider';
import type MenuActionProvider from 'components/suggestion/menu_action_provider';

export type ReactSelectOption = {
    label: string;
    value: string;
};

export type ReactSelectGroup = {
    label: string;
    options: ReactSelectOption[];
};

export type MmBlocksSelectProvider = GenericUserProvider | GenericChannelProvider | MenuActionProvider;

export const reactSelectStyles = {
    menuPortal: (provided) => ({
        ...provided,
        zIndex: 9999,
    }),
} satisfies StylesConfig<ReactSelectOption, boolean>;

export function toReactSelectOption(option: MmStaticSelectOption): ReactSelectOption {
    return {label: option.text, value: option.value};
}

export function flattenSelectOptions(element: MmSelectInputBlock): MmStaticSelectOption[] {
    if (element.option_groups?.length) {
        return element.option_groups.flatMap((group) => group.options);
    }
    return element.options ?? [];
}

export function toReactSelectOptions(element: MmSelectInputBlock): Array<ReactSelectOption | ReactSelectGroup> {
    if (element.option_groups?.length) {
        return element.option_groups.map((group: MmSelectOptionGroup) => ({
            label: group.label,
            options: group.options.map(toReactSelectOption),
        }));
    }
    return (element.options ?? []).map(toReactSelectOption);
}

export function initialSingleValue(element: MmSelectInputBlock): string {
    return element.initial_option ?? '';
}

export function initialMultiValue(element: MmSelectInputBlock): string[] {
    if (element.initial_options?.length) {
        return [...element.initial_options];
    }
    if (element.initial_option) {
        return [element.initial_option];
    }
    return [];
}

export function normalizeSingleValue(value: unknown, fallback: string): string {
    if (typeof value === 'string') {
        return value;
    }
    return fallback;
}

export function normalizeMultiValue(value: unknown, fallback: string[]): string[] {
    if (Array.isArray(value)) {
        return value.map(String);
    }
    if (typeof value === 'string' && value) {
        return value.split(',').map((v) => v.trim()).filter(Boolean);
    }
    return fallback;
}

export function displayTextForValue(options: MmStaticSelectOption[], value: string): string {
    return options.find((o) => o.value === value)?.text ?? '';
}
