// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {FocusEventHandler, KeyboardEventHandler} from 'react';
import React, {useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import type {GroupBase} from 'react-select';
import {components} from 'react-select';
import type {CreatableProps} from 'react-select/creatable';
import CreatableSelect from 'react-select/creatable';

import {LockOutlineIcon} from '@mattermost/compass-icons/components';
import {supportsOptions, type BoardPropertyField, type PropertyFieldOption} from '@mattermost/types/properties';

import Constants from 'utils/constants';

import {DangerText} from '../system_properties/controls';

import '../system_properties/user_properties_values.scss';

type Props = {
    field: BoardPropertyField;
    updateField: (field: BoardPropertyField) => void;
    autoFocus?: boolean;
}

type Option = {label: string; id: string; value: string};
type SelectProps = CreatableProps<Option, true, GroupBase<Option>>;

// Status option IDs that are seeded and cannot be removed
const boardsStatusOptionIds = new Set(['boards_status_todo', 'boards_status_in_progress', 'boards_status_complete']);

// Color map for status option swatches
const statusColorMap: {[key: string]: string} = {
    neutral: 'rgba(var(--center-channel-color-rgb), 0.48)',
    blue: '#1c58d9',
    green: '#3db887',
};

const BoardAttributesValues = ({
    field,
    updateField,
    autoFocus,
}: Props) => {
    const {formatMessage} = useIntl();

    const [query, setQuery] = React.useState('');

    const isQueryValid = useMemo(() => !checkForDuplicates(field.attrs?.options, query.trim()), [field?.attrs?.options, query]);

    const addOption = (name: string) => {
        const option: PropertyFieldOption = {
            id: '',
            name: name.trim(),
        };

        updateField({...field, attrs: {...field.attrs, options: [...(field.attrs?.options ?? []), option]}});
    };

    const setFieldOptions = (options: PropertyFieldOption[]) => {
        updateField({...field, attrs: {...field.attrs, options}});
    };

    const processQuery = (query: string) => {
        addOption(query);
        setQuery('');
    };

    const handleKeyDown: KeyboardEventHandler = (event) => {
        if (!query || !isQueryValid) {
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
        if (!query || !isQueryValid) {
            return;
        }

        processQuery(query);
        event.preventDefault();
    };

    // Protected fields (system-managed) show a lock icon and dash
    if (field.protected) {
        return (
            <span className='user-property-field-values'>
                <LockOutlineIcon size={18}/>
                <FormattedMessage
                    id='admin.board_attributes.user_properties.table.values.system_managed'
                    defaultMessage='—'
                />
            </span>
        );
    }

    // User type: assignee is set at card level, not here
    if (field.type === 'user') {
        return (
            <span className='user-property-field-values'>
                {'—'}
            </span>
        );
    }

    if (!supportsOptions(field)) {
        return (
            <span className='user-property-field-values'>
                {'-'}
            </span>
        );
    }

    const isDisabled = field.delete_at !== 0;

    const isStatusField = field.name === 'status';

    // For status field: build custom MultiValueRemove that disables removal of seeded options
    const customComponents: SelectProps['components'] = {
        DropdownIndicator: undefined,
        ClearIndicator: undefined,
        IndicatorsContainer: () => null,
        Input: (inputProps) => {
            return (
                <components.Input
                    {...inputProps}
                    maxLength={Constants.MAX_CUSTOM_ATTRIBUTE_LENGTH}
                />
            );
        },
        ...(isStatusField ? {
            MultiValueRemove: (removeProps) => {
                const optionId = (removeProps.data as Option).id;
                if (boardsStatusOptionIds.has(optionId)) {
                    return null;
                }
                return <components.MultiValueRemove {...removeProps}/>;
            },
        } : {}),
    };

    return (
        <>
            <CreatableSelect<Option, true, GroupBase<Option>>
                components={customComponents}
                inputValue={query}
                isClearable={true}
                isMulti={true}
                menuIsOpen={false}
                isDisabled={isDisabled}
                onChange={(newValues) => {
                    setFieldOptions(newValues.map(({id, value}) => ({id, name: value})));
                }}
                onInputChange={(newValue) => setQuery(newValue)}
                onKeyDown={handleKeyDown}
                onBlur={handleOnBlur}
                placeholder={formatMessage({id: 'admin.board_attributes.user_properties.table.values.placeholder', defaultMessage: 'Add values… (required)'})}
                value={field.attrs?.options?.map((option) => ({label: option.name, value: option.name, id: option.id}))}
                menuPortalTarget={document.body}
                styles={getStyles(isStatusField, field.attrs?.options)}
                autoFocus={autoFocus}
            />
            {!isQueryValid && (
                <FormattedMessage
                    tagName={DangerText}
                    id='admin.board_attributes.user_properties.table.validation.values_unique'
                    defaultMessage='Values must be unique.'
                />
            )}
        </>
    );
};

const checkForDuplicates = (options: PropertyFieldOption[] | undefined, newOptionName: string) => {
    return options?.some((option) => option.name === newOptionName);
};

const getStyles = (isStatusField: boolean, options?: PropertyFieldOption[]): SelectProps['styles'] => ({
    multiValue: (base, props) => {
        const optionId = (props.data as Option).id;
        const option = options?.find((o) => o.id === optionId);
        const colorKey = option?.color;
        const dotColor = colorKey ? (statusColorMap[colorKey] ?? colorKey) : undefined;

        return {
            ...base,
            borderRadius: '12px',
            paddingLeft: '6px',
            paddingTop: '1px',
            paddingBottom: '1px',
            backgroundColor: 'rgba(var(--center-channel-color-rgb), 0.08)',
            ...(isStatusField && dotColor ? {
                display: 'flex',
                alignItems: 'center',
                '&::before': {
                    content: '""',
                    display: 'inline-block',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: dotColor,
                    marginRight: '4px',
                    flexShrink: 0,
                },
            } : {}),
        };
    },
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
        overflowY: 'auto',
        border: 'none',
        borderRadius: '0',
        ...props.isFocused && {
            border: 'none',
            boxShadow: 'none',
            background: 'rgba(var(--button-bg-rgb), 0.08)',
        },
        '&:hover': {
            background: 'rgba(var(--button-bg-rgb), 0.08)',
            cursor: 'text',
        },
    }),
});

export default BoardAttributesValues;
