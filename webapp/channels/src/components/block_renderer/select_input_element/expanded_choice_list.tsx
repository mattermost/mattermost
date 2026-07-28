// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {MmSelectOptionGroup, MmStaticSelectOption} from '@mattermost/types/mm_blocks';

import Setting from 'components/widgets/settings/setting';

type ExpandedChoiceListProps = {
    id: string;
    label: React.ReactNode;
    helpText?: React.ReactNode;
    options?: MmStaticSelectOption[];
    optionGroups?: MmSelectOptionGroup[];
    multiselect: boolean;
    value: string | string[];
    disabled: boolean;
    onChange: (name: string, value: string | string[]) => void;
};

/** Expanded presentation: radios (single) or checkboxes (multi), with optional option groups. */
export function ExpandedChoiceList({
    id,
    label,
    helpText,
    options = [],
    optionGroups,
    multiselect,
    value,
    disabled,
    onChange,
}: ExpandedChoiceListProps) {
    let selected: string | string[];
    if (multiselect) {
        selected = Array.isArray(value) ? value : [];
    } else {
        selected = typeof value === 'string' ? value : '';
    }

    const renderOption = (option: MmStaticSelectOption) => {
        if (multiselect) {
            const checked = (selected as string[]).includes(option.value);
            return (
                <div
                    className='checkbox'
                    key={option.value}
                >
                    <label>
                        <input
                            type='checkbox'
                            value={option.value}
                            name={id}
                            checked={checked}
                            disabled={disabled}
                            onChange={() => {
                                const current = selected as string[];
                                let next: string[];
                                if (checked) {
                                    next = current.filter((v) => v !== option.value);
                                } else {
                                    next = [...current, option.value];
                                }
                                onChange(id, next);
                            }}
                        />
                        {option.text}
                    </label>
                </div>
            );
        }

        return (
            <div
                className='radio'
                key={option.value}
            >
                <label>
                    <input
                        type='radio'
                        value={option.value}
                        name={id}
                        checked={option.value === selected}
                        disabled={disabled}
                        onChange={() => onChange(id, option.value)}
                    />
                    {option.text}
                </label>
            </div>
        );
    };

    return (
        <Setting
            label={label}
            helpText={helpText}
            inputId={id}
        >
            <fieldset disabled={disabled}>
                {optionGroups?.length ? (
                    optionGroups.map((group) => (
                        <div
                            key={group.label}
                            className='mm-blocks-select-input__option-group'
                        >
                            <div className='mm-blocks-select-input__option-group-label'>
                                {group.label}
                            </div>
                            {group.options.map(renderOption)}
                        </div>
                    ))
                ) : (
                    options.map(renderOption)
                )}
            </fieldset>
        </Setting>
    );
}
