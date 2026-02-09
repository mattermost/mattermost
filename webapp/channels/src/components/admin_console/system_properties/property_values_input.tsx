// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import {FormattedList, FormattedMessage, useIntl} from 'react-intl';
import styled from 'styled-components';

import {PlusIcon, SyncIcon, TrashCanOutlineIcon} from '@mattermost/compass-icons/components';
import {type PropertyFieldOption, type PropertyField, type UserPropertyField} from '@mattermost/types/properties';

import * as Menu from 'components/menu';
import WithTooltip from 'components/with_tooltip';

import {useAttributeLinkModal} from './user_properties_dot_menu';

type Props = {
    field: PropertyField;
    updateField: (field: PropertyField) => void;
};

const PropertyValuesInput = ({
    field,
    updateField,
}: Props) => {
    const {formatMessage} = useIntl();

    // Only show LDAP/SAML links for UserPropertyField (custom_profile_attributes)
    const isUserPropertyField = field.group_id === 'custom_profile_attributes';

    // Always call hook (React rules), but only use it if it's a user property field
    // Create a dummy field for non-user fields to satisfy hook requirements
    const dummyField: UserPropertyField = {
        id: '',
        name: '',
        type: 'text',
        group_id: 'custom_profile_attributes',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        created_by: '',
        updated_by: '',
        attrs: {
            sort_order: 0,
            visibility: 'when_set',
            value_type: '',
        },
    };
    const attributeLinkModal = useAttributeLinkModal(
        (isUserPropertyField ? field as UserPropertyField : dummyField),
        (isUserPropertyField ? updateField as (field: UserPropertyField) => void : () => {}),
    );
    const {promptEditLdapLink, promptEditSamlLink} = attributeLinkModal;

    const fieldAttrs = field.attrs as {options?: PropertyFieldOption[]; ldap?: string; saml?: string};

    const generateDefaultName = () => {
        const currentOptions = fieldAttrs?.options || [];
        const existingNames = new Set(currentOptions.map((option: PropertyFieldOption) => option.name.toLowerCase()));

        let counter = 1;
        let defaultName = `Option ${counter}`;

        while (existingNames.has(defaultName.toLowerCase())) {
            counter++;
            defaultName = `Option ${counter}`;
        }

        return defaultName;
    };

    const addNewValue = () => {
        const currentOptions = fieldAttrs?.options || [];
        const newOption: PropertyFieldOption = {
            id: '', // empty id, real id assigned by server
            name: generateDefaultName(),
        };
        updateField({
            ...field,
            attrs: {
                ...field.attrs,
                options: [...currentOptions, newOption],
            },
        });
    };

    const setFieldOptions = (options: PropertyFieldOption[]) => {
        updateField({
            ...field,
            attrs: {
                ...field.attrs,
                options,
            },
        });
    };

    if (isUserPropertyField && (fieldAttrs?.ldap || fieldAttrs?.saml)) {
        const syncedProperties = [
            fieldAttrs?.ldap && (
                <button
                    type='button'
                    className='user-property-field-values__chip-link'
                    key={`${field.name}-ldap`}
                    data-testid={`user-property-field-values__ldap-${field.name}`}
                    onClick={() => promptEditLdapLink()}
                >
                    {formatMessage(
                        {id: 'admin.system_properties.user_properties.table.values.synced_with.ldap', defaultMessage: 'AD/LDAP: {propertyName}'},
                        {propertyName: fieldAttrs?.ldap},
                    )}
                </button>
            ),
            fieldAttrs?.saml && (
                <button
                    type='button'
                    className='user-property-field-values__chip-link'
                    key={`${field.name}-saml`}
                    data-testid={`user-property-field-values__saml-${field.name}`}
                    onClick={() => promptEditSamlLink()}
                >
                    {formatMessage(
                        {id: 'admin.system_properties.user_properties.table.values.synced_with.saml', defaultMessage: 'SAML: {propertyName}'},
                        {propertyName: fieldAttrs?.saml},
                    )}
                </button>
            ),
        ].filter(Boolean);

        return (
            <Container>
                <span className='user-property-field-values'>
                    <SyncIcon size={18}/>
                    <FormattedMessage
                        id='admin.system_properties.user_properties.table.values.synced_with'
                        defaultMessage='Synced with: {syncedProperties}'
                        values={{syncedProperties: <FormattedList value={syncedProperties}/>}}
                    />
                </span>
            </Container>
        );
    }

    // Type guard: check if field supports options (select/multiselect)
    const fieldType = (field as PropertyField & {type?: string}).type;
    if (fieldType !== 'select' && fieldType !== 'multiselect') {
        return (
            <Container>
                <EmptyValues>
                    <FormattedMessage
                        id='admin.system_properties.user_properties.table.values.empty'
                        defaultMessage='-'
                    />
                </EmptyValues>
            </Container>
        );
    }

    return (
        <Container data-testid='property-values-input'>
            <ValuesContainer>
                {fieldAttrs?.options?.map((option: PropertyFieldOption, index: number) => (
                    <ClickableMultiValue
                        key={option.id || `option_${index}_${option.name}`}
                        data={{label: option.name, id: option.id, index}}
                        field={field}
                        setFieldOptions={setFieldOptions}
                        formatMessage={formatMessage}
                    />
                ))}
                <WithTooltip
                    id='add_value_tooltip'
                    title={formatMessage({id: 'admin.system_properties.user_properties.table.values.add_value', defaultMessage: 'Add value'})}
                >
                    <AddButton
                        onClick={addNewValue}
                        title={formatMessage({id: 'admin.system_properties.user_properties.table.values.add_value', defaultMessage: 'Add value'})}
                        aria-label={formatMessage({id: 'admin.system_properties.user_properties.table.values.add_value', defaultMessage: 'Add value'})}
                    >
                        <PlusIcon size={16}/>
                    </AddButton>
                </WithTooltip>
            </ValuesContainer>
        </Container>
    );
};

// Custom MultiValue component with dropdown functionality
const ClickableMultiValue = (props: {
    data: {label: string; id: string; index?: number};
    field: PropertyField;
    setFieldOptions: (options: PropertyFieldOption[]) => void;
    formatMessage: (descriptor: {id?: string; defaultMessage: string}) => string;
}) => {
    const {data, field, setFieldOptions, formatMessage} = props;
    const [editValue, setEditValue] = useState(data.label);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Use a stable ID for the selector - prefer the option ID, fallback to index-based
    const selectorId = data.id || `option_${data.index ?? 0}`;

    useEffect(() => {
        setEditValue(data.label);
    }, [data.label]);
    const handleRename = useCallback(() => {
        const trimmedValue = editValue.trim();
        if (trimmedValue && trimmedValue !== data.label) {
            // Check for duplicates
            const fieldAttrs = field.attrs as {options?: PropertyFieldOption[]};
            const existingOptions: PropertyFieldOption[] = fieldAttrs?.options || [];
            const isDuplicate = existingOptions.some((option: PropertyFieldOption, idx: number) => {
                // Use index when ID is empty to avoid matching all empty IDs
                if (data.id) {
                    return option.name === trimmedValue && option.id !== data.id;
                }
                return option.name === trimmedValue && idx !== data.index;
            });

            if (!isDuplicate) {
                const updatedOptions = existingOptions.map((option: PropertyFieldOption, idx: number) => {
                    // Use index when ID is empty to uniquely identify the option
                    if (data.id) {
                        return option.id === data.id ? {...option, name: trimmedValue} : option;
                    }
                    return idx === data.index ? {...option, name: trimmedValue} : option;
                });
                setFieldOptions(updatedOptions);
            }
        }
    }, [editValue, data.label, data.id, data.index, field.attrs, setFieldOptions]);

    useEffect(() => {
        if (isMenuOpen) {
            // Focus and select input when menu opens
            // Use querySelector to find the input since Menu.InputItem doesn't expose ref directly
            // Option IDs may be empty strings, so we use a fallback ID format based on index
            setTimeout(() => {
                const escapedId = CSS.escape(selectorId);
                const inputElement = document.querySelector(`#rename_value_${escapedId} input`) as HTMLInputElement;
                if (inputElement) {
                    inputElement.focus();
                    inputElement.select();
                }
            }, 100);
        } else {
            // Save on close
            handleRename();
            setEditValue(data.label);
        }
    }, [isMenuOpen, selectorId, data.label, handleRename]);

    const handleDelete = () => {
        const fieldAttrs = field.attrs as {options?: PropertyFieldOption[]};
        const currentOptions: PropertyFieldOption[] = fieldAttrs?.options || [];

        // Prevent deleting the last option
        if (currentOptions.length <= 1) {
            return;
        }

        // Use index when ID is empty to uniquely identify the option
        const updatedOptions = currentOptions.filter((option: PropertyFieldOption, idx: number) => {
            if (data.id) {
                return option.id !== data.id;
            }
            return idx !== data.index;
        });
        setFieldOptions(updatedOptions);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
            handleRename();
            setIsMenuOpen(false);
        } else if (e.key === 'Escape') {
            setEditValue(props.data.label);
            setIsMenuOpen(false);
        }
    };

    const handleBlur = () => {
        handleRename();
    };

    const fieldAttrs = field.attrs as {options?: PropertyFieldOption[]};
    const canDelete = fieldAttrs?.options && fieldAttrs.options.length > 1;

    return (
        <Menu.Container
            menuButton={{
                id: `property-value-${props.data.id}`,
                as: 'div',
                children: (
                    <MultiValueContainer>
                        <MultiValueLabel>{props.data.label}</MultiValueLabel>
                    </MultiValueContainer>
                ),
            }}
            menu={{
                id: `property-value-menu-${props.data.id}`,
                'aria-label': 'Edit value',
                onToggle: setIsMenuOpen,
            }}
        >
            <Menu.InputItem
                key={`rename_value_${selectorId}`}
                id={`rename_value_${selectorId}`}
                type='text'
                placeholder={formatMessage({id: 'admin.system_properties.user_properties.table.values.enter_value_name', defaultMessage: 'Enter value name'})}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                maxLength={255}
            />
            {canDelete && (
                <Menu.Item
                    id={`delete-value-${data.id}`}
                    onClick={handleDelete}
                    isDestructive={true}
                    leadingElement={<TrashCanOutlineIcon size={16}/>}
                    labels={(
                        <span>
                            {formatMessage({id: 'admin.system_properties.user_properties.table.values.delete', defaultMessage: 'Delete'})}
                        </span>
                    )}
                />
            )}
        </Menu.Container>
    );
};

const Container = styled.div`
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
`;

const ValuesContainer = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    padding: 8px;
    min-height: 40px;
    background: transparent;

    &:hover {
        background: rgba(var(--button-bg-rgb), 0.08);
    }
`;

const AddButton = styled.button`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    cursor: pointer;
    font-family: 'Open Sans';
    font-size: 12px;
    font-weight: 600;
    transition: all 0.15s ease;

    &:hover {
        color: var(--center-channel-color);
        background: rgba(var(--center-channel-color-rgb), 0.04);
    }

    &:active {
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }
`;

const EmptyValues = styled.div`
    padding: 4px 8px;
`;

const MultiValueContainer = styled.div`
    border-radius: 4px;
    padding: 4px 12px;
    background-color: rgba(var(--center-channel-color-rgb), 0.08);
    display: flex;
    align-items: center;
    cursor: pointer;
    user-select: none;

    &:hover {
        background-color: rgba(var(--center-channel-color-rgb), 0.12);
    }
`;

const MultiValueLabel = styled.span`
    color: var(--center-channel-color);
    font-family: 'Open Sans';
    font-size: 12px;
    font-style: normal;
    font-weight: 600;
    line-height: 16px;
`;

export default PropertyValuesInput;
