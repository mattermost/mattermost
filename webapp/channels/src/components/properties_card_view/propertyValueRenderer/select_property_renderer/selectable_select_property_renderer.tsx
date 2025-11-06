// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import type {StylesConfig, SingleValue} from 'react-select';
import ReactSelect from 'react-select';

import type {SelectPropertyField} from '@mattermost/types/properties';

import './selectable_select_property_renderer.scss';

type OptionType = {
    label: string;
    value: string;
    color?: string;
};

export type SelectPropertyMetadata = {
    setValue?: (value: string) => void;
};

type Props = {
    field: SelectPropertyField;
    metadata?: SelectPropertyMetadata;
    initialValue?: string;
};

const reactStyles: StylesConfig<OptionType, false> = {
    control: (provided, state) => ({
        ...provided,
        minHeight: '32px',
        height: '32px',
        border: 'none',
        boxShadow: 'none',
        cursor: 'pointer',
        backgroundColor: state.isDisabled ? 'transparent' : 'rgba(var(--center-channel-color-rgb), 0.08)',
        '&:hover': {
            backgroundColor: 'rgba(var(--center-channel-color-rgb), 0.12)',
        },
    }),
    valueContainer: (provided) => ({
        ...provided,
        padding: '0 8px',
        height: '32px',
    }),
    singleValue: (provided) => ({
        ...provided,
        color: 'var(--center-channel-color)',
        fontSize: '14px',
    }),
    indicatorSeparator: () => ({
        display: 'none',
    }),
    dropdownIndicator: (provided) => ({
        ...provided,
        padding: '4px',
        svg: {
            width: '16px',
            height: '16px',
        },
    }),
    menu: (provided) => ({
        ...provided,
        zIndex: 9999,
    }),
    menuPortal: (provided) => ({
        ...provided,
        zIndex: 9999,
    }),
    option: (provided, state) => {
        let backgroundColor = 'transparent';
        if (state.isSelected) {
            backgroundColor = 'rgba(var(--button-bg-rgb), 0.08)';
        } else if (state.isFocused) {
            backgroundColor = 'rgba(var(--center-channel-color-rgb), 0.08)';
        }

        return {
            ...provided,
            cursor: 'pointer',
            backgroundColor,
            color: 'var(--center-channel-color)',
            '&:active': {
                backgroundColor: 'rgba(var(--button-bg-rgb), 0.12)',
            },
        };
    },
};

export function SelectableSelectPropertyRenderer({
    field,
    metadata,
    initialValue,
}: Props) {
    const [value, setValue] = useState(initialValue || '');

    useEffect(() => {
        setValue(initialValue || '');
    }, [initialValue]);

    const options: OptionType[] = useMemo(() => {
        if (!field.attrs?.options) {
            return [];
        }

        return field.attrs.options.map((option) => ({
            label: option.name,
            value: option.name,
            color: option.color,
        }));
    }, [field.attrs?.options]);

    const selectedOption = useMemo(() => {
        return options.find((opt) => opt.value === value) || null;
    }, [options, value]);

    const handleChange = useCallback((newValue: SingleValue<OptionType>) => {
        if (newValue) {
            setValue(newValue.value);
            if (metadata?.setValue) {
                metadata.setValue(newValue.value);
            }
        }
    }, [metadata]);

    if (!field.attrs?.options || options.length === 0) {
        return null;
    }

    return (
        <div
            className='SelectableSelectPropertyRenderer'
            data-testid='selectable-select-property'
        >
            <ReactSelect<OptionType>
                value={selectedOption}
                onChange={handleChange}
                options={options}
                isSearchable={false}
                placeholder='Select...'
                styles={reactStyles}
                classNamePrefix='selectable-select-property'
                menuPortalTarget={document.body}
            />
        </div>
    );
}
