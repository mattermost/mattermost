// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import ReactSelect, {StylesConfig} from 'react-select';
import {
    CheckIcon,
    ChevronDownCircleOutlineIcon,
    FormatListBulletedIcon,
    LinkVariantIcon,
    MenuVariantIcon,
} from '@mattermost/compass-icons/components';

import {FieldType} from '@mattermost/types/properties';

import type {PropertyField} from 'src/types/properties';

import Dropdown from 'src/components/dropdown';

import {hasOptions, supportsOptions} from './property_utils';

interface Props {
    field: PropertyField;
    updateField: (field: PropertyField) => void;
    onClose?: () => void;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    target: React.ReactElement;
}

type PropertyType = 'text' | 'select' | 'multiselect' | 'url';

type TypeOption = {
    value: PropertyType;
    label: JSX.Element;
    type: PropertyType;
};

const TYPE_OPTIONS: Array<{
    type: PropertyType;
    icon: React.ComponentType<{size?: number}>;
    label: string;
}> = ([
    {
        type: 'text',
        icon: MenuVariantIcon,
        label: 'Text',
    },
    {
        type: 'url',
        icon: LinkVariantIcon,
        label: 'URL',
    },
    {
        type: 'select',
        icon: ChevronDownCircleOutlineIcon,
        label: 'Select',
    },
    {
        type: 'multiselect',
        icon: FormatListBulletedIcon,
        label: 'Multi-select',
    },
]) as const;

const PropertyTypeSelector = ({
    field,
    updateField,
    onClose,
    isOpen,
    onOpenChange,
    target,
}: Props) => {
    const handleTypeSelect = (option: TypeOption | null | undefined) => {
        if (!option) {
            return;
        }

        let actualType: FieldType = 'text';
        let valueType: string | undefined = field.attrs?.value_type;

        switch (option.type) {
        case 'url':
            actualType = 'text';
            valueType = 'url';
            break;
        case 'text':
            actualType = 'text';
            valueType = '';
            break;
        case 'select':
            actualType = 'select';
            valueType = '';
            break;
        case 'multiselect':
            actualType = 'multiselect';
            valueType = '';
            break;
        }

        const nextField = {...field, type: actualType, attrs: {...field.attrs, value_type: valueType}};

        if (!supportsOptions(nextField) && hasOptions(nextField)) {
            // Remove options if not supported
            nextField.attrs = {...nextField.attrs || {}};
            Reflect.deleteProperty(nextField.attrs, 'options');
        } else if (supportsOptions(nextField) && !hasOptions(nextField)) {
            // Add default option if supported and none exist
            nextField.attrs = {
                ...nextField.attrs,
                options: [{
                    id: '',
                    name: 'Option 1',
                }],
            };
        }

        updateField(nextField);
        onClose?.();
        onOpenChange(false);
    };

    const typeOptions: TypeOption[] = TYPE_OPTIONS.map((option) => {
        const Icon = option.icon;
        const isSelected = option.type === 'url' ? field.type === 'text' && field.attrs?.value_type === 'url' : option.type === field.type && (!field.attrs?.value_type || field.attrs.value_type === '');

        return {
            value: option.type,
            type: option.type,
            label: (
                <ItemContent>
                    <ItemLeft>
                        <Icon size={18}/>
                        {option.label}
                    </ItemLeft>
                    {isSelected && (
                        <CheckIcon
                            size={16}
                            color='var(--button-bg)'
                        />
                    )}
                </ItemContent>
            ),
        };
    });

    const selectedOption = typeOptions.find((option) => {
        if (option.type === 'url') {
            return field.type === 'text' && field.attrs?.value_type === 'url';
        }
        return option.type === field.type && (!field.attrs?.value_type || field.attrs.value_type === '');
    });

    return (
        <Dropdown
            target={target}
            placement='bottom-start'
            isOpen={isOpen}
            onOpenChange={onOpenChange}
        >
            <ReactSelect
                autoFocus={true}
                backspaceRemovesValue={false}
                components={{DropdownIndicator: null, IndicatorSeparator: null}}
                controlShouldRenderValue={false}
                hideSelectedOptions={false}
                menuIsOpen={true}
                options={typeOptions}
                placeholder='Select type'
                styles={selectStyles}
                tabSelectsValue={false}
                value={selectedOption}
                onChange={handleTypeSelect}
                classNamePrefix='playbook-react-select'
                className='playbook-react-select'
            />
        </Dropdown>
    );
};

const ItemContent = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
`;

const ItemLeft = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;

    span {
        font-size: 14px;
        color: var(--center-channel-color);
    }
`;

const selectStyles: StylesConfig<TypeOption, false> = {
    control: (provided) => ({...provided, minWidth: 140, margin: 8}),
    menu: () => ({boxShadow: 'none'}),
    option: (provided, state) => {
        const hoverColor = 'rgba(20, 93, 191, 0.08)';
        const bgHover = state.isFocused ? hoverColor : 'transparent';
        return {
            ...provided,
            backgroundColor: state.isSelected ? hoverColor : bgHover,
            color: 'unset',
        };
    },
};

export default PropertyTypeSelector;
