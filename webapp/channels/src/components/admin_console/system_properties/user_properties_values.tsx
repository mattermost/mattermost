// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import max from 'lodash/max';
import type {ComponentProps, FocusEventHandler, KeyboardEventHandler} from 'react';
import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import type {GroupBase} from 'react-select';
import {components} from 'react-select';
import type {CreatableProps} from 'react-select/creatable';
import CreatableSelect from 'react-select/creatable';

import type {PropertyFieldOption, UserPropertyField} from '@mattermost/types/properties';

import Constants from 'utils/constants';

// import './user_properties_dot_menu.scss';

type Props = {
    field: UserPropertyField;
    updateField: (field: UserPropertyField) => void;
}

type Option = {label: string; id: string; value: string};
type SelectProps = CreatableProps<Option, true, GroupBase<Option>>;

const UserPropertyValues = ({
    field,
    updateField,
}: Props) => {
    const {formatMessage} = useIntl();

    const [query, setQuery] = React.useState('');

    const addOption = (name: string) => {
        const option: PropertyFieldOption = {
            id: '',
            name,
        };

        updateField({...field, attrs: {...field.attrs, options: [...field.attrs.options ?? [], option]}});
    };

    const setOptions = (options: PropertyFieldOption[]) => {
        updateField({...field, attrs: {...field.attrs, options}});
    };

    const processQuery = (query: string) => {
        addOption(query);
        setQuery('');
    };

    const handleKeyDown: KeyboardEventHandler = (event) => {
        if (!query) {
            return;
        }

        switch (event.key) {
        case 'Enter':
        case 'Tab':
            processQuery(query);
            event.preventDefault();
        }
    };

    const handleOnBlur: FocusEventHandler = (event) => {
        if (!query) {
            return;
        }

        processQuery(query);
        event.preventDefault();
    };

    if (field.type !== 'multiselect' && field.type !== 'select') {
        return (
            <>
                {'-'}
            </>
        );
    }

    return (
        <>
            <CreatableSelect<Option, true, GroupBase<Option>>
                components={customComponents}
                inputValue={query}
                isClearable={true}
                isMulti={true}
                menuIsOpen={false}

                onChange={(newValue) => {
                    setOptions(newValue.map((option) => ({id: option.id, name: option.value})));
                }}
                onInputChange={(newValue) => setQuery(newValue)}
                onKeyDown={handleKeyDown}
                onBlur={handleOnBlur}
                placeholder={formatMessage({id: 'admin.system_properties.user_properties.table.values.placeholder', defaultMessage: 'Add values (required)'})}
                value={field.attrs.options?.map((option) => ({label: option.name, value: option.name, id: option.id}))}
                menuPortalTarget={document.body}
                styles={styles}
            />
        </>
    );
};

const customComponents: SelectProps['components'] = {
    DropdownIndicator: undefined,
    ClearIndicator: undefined,
    Input: (props) => (
        <components.Input
            {...props}
            maxLength={Constants.MAX_CUSTOM_ATTRIBUTE_LENGTH}
        />
    ),
};

const styles: SelectProps['styles'] = {
    multiValue: (base) => ({
        ...base,
        borderRadius: '12px',
        paddingLeft: '6px',
        paddingTop: '1px',
        paddingBottom: '1px',
    }),
    multiValueLabel: (base) => ({
        ...base,
        color: 'var(--center-channel-color)',
        fontFamily: 'Open Sans',
        fontSize: '12px',
        fontStyle: 'normal',
        fontWeight: 600,
        lineHeight: '16px',
    }),
    multiValueRemove: (base) => ({
        ...base,
        cursor: 'pointer',
        color: 'var(--center-channel-color)',
        borderRadius: '0 12px 12px 0',
        '&:hover': {
            backgroundColor: 'rgba(var(--center-channel-color-rgb), 0.08)',
            color: 'var(--center-channel-color)',
        },
    }),
    control: (base, props) => ({
        ...base,
        minHeight: '40px',
        maxHeight: '40px',
        overflowY: 'auto',
        border: 'none',
        borderRadius: '0',
        ...props.isFocused && {
            border: 'none',
            boxShadow: 'none',
            background: 'rgba(var(--button-bg-rgb), 0.08)',
            maxHeight: 'none',
        },
        '&:hover': {
            background: 'rgba(var(--button-bg-rgb), 0.08)',
            cursor: 'text',
        },
    }),
};

export default UserPropertyValues;

