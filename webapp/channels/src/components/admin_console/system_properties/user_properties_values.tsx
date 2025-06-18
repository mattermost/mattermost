// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {FocusEventHandler, KeyboardEventHandler} from 'react';
import React, {useMemo, useState} from 'react';
import {FormattedList, FormattedMessage, useIntl} from 'react-intl';
import type {GroupBase} from 'react-select';
import {components} from 'react-select';
import type {CreatableProps} from 'react-select/creatable';
import CreatableSelect from 'react-select/creatable';

import {SyncIcon} from '@mattermost/compass-icons/components';
import type {PropertyFieldOption, UserPropertyField} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';

import Constants from 'utils/constants';

import AttributeModal from './attribute_modal';
import {DangerText} from './controls';

import './user_properties_values.scss';

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
    const [showLdapModal, setShowLdapModal] = useState(false);
    const [showSamlModal, setShowSamlModal] = useState(false);
    const [error, setError] = useState('');
    const [errorSaml, setErrorSaml] = useState('');

    const isQueryValid = useMemo(() => !checkForDuplicates(field.attrs.options, query.trim()), [field?.attrs?.options, query]);

    const addOption = (name: string) => {
        const option: PropertyFieldOption = {
            id: '',
            name: name.trim(),
        };

        updateField({...field, attrs: {...field.attrs, options: [...field.attrs.options ?? [], option]}});
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

    const handleLdapSave = async (value: string) => {
        setError('');
        try {
            const updatedAttr = {
                type: field.type,
                attrs: {
                    ...field.attrs,
                    ldap: value,
                },
            };
            await Client4.patchCustomProfileAttributeField(field.id, updatedAttr);
            updateField({...field, attrs: {...field.attrs, ldap: value}});
            setShowLdapModal(false);
        } catch (err: any) {
            setError('Failed to update LDAP attribute.');
        }
    };

    const handleSamlSave = async (value: string) => {
        setErrorSaml('');
        try {
            const updatedAttr = {
                type: field.type,
                attrs: {
                    ...field.attrs,
                    saml: value,
                },
            };
            await Client4.patchCustomProfileAttributeField(field.id, updatedAttr);
            updateField({...field, attrs: {...field.attrs, saml: value}});
            setShowSamlModal(false);
        } catch (err: any) {
            setErrorSaml('Failed to update SAML attribute.');
        }
    };

    if (field.attrs.ldap || field.attrs.saml) {
        const syncedProperties = [

            field.attrs.ldap && (
                <span
                    className='user-property-field-values__chip-link'
                    key={`${field.name}-ldap`}
                    data-testid={`user-property-field-values__ldap-${field.name}`}
                    onClick={() => setShowLdapModal(true)}
                    style={{cursor: 'pointer'}}
                >
                    <FormattedMessage
                        id='admin.system_properties.user_properties.table.values.synced_with.ldap'
                        defaultMessage='AD/LDAP: {propertyName}'
                        values={{propertyName: field.attrs.ldap}}
                    />
                </span>
            ),
            field.attrs.saml && (
                <span
                    className='user-property-field-values__chip-link'
                    key={`${field.name}-saml`}
                    data-testid={`user-property-field-values__saml-${field.name}`}
                    onClick={() => setShowSamlModal(true)}
                    style={{cursor: 'pointer'}}
                >
                    <FormattedMessage
                        id='admin.system_properties.user_properties.table.values.synced_with.saml'
                        defaultMessage='SAML: {propertyName}'
                        values={{propertyName: field.attrs.saml}}
                    />
                </span>
            ),

        ].filter(Boolean);

        return (
            <>
                <span className='user-property-field-values'>
                    <SyncIcon size={18}/>
                    <FormattedMessage
                        id='admin.system_properties.user_properties.table.values.synced_with'
                        defaultMessage='Synced with: {syncedProperties}'
                        values={{syncedProperties: <FormattedList value={syncedProperties}/>}}
                    />
                </span>
                {showLdapModal && (
                    <AttributeModal
                        initialValue={field.attrs.ldap || ''}
                        onExited={() => {
                            setShowLdapModal(false);
                            setError('');
                        }}
                        onSave={handleLdapSave}
                        error={error}
                        helpText={
                            <FormattedMessage
                                id='admin.system_properties.user_properties.dotmenu.ad_ldap.modal.helpText'
                                defaultMessage="The attribute in the AD/LDAP server used to sync as a custom attribute in user's profile in Mattermost."
                            />
                        }
                        modalHeaderText={
                            <FormattedMessage
                                id='admin.system_properties.user_properties.dotmenu.ad_ldap.modal.title'
                                defaultMessage='Link attribute to AD/LDAP'
                            />
                        }
                    />
                )}
                {showSamlModal && (
                    <AttributeModal
                        initialValue={field.attrs.saml || ''}
                        onExited={() => {
                            setShowSamlModal(false);
                            setErrorSaml('');
                        }}
                        onSave={handleSamlSave}
                        error={errorSaml}
                        helpText={
                            <FormattedMessage
                                id='admin.system_properties.user_properties.dotmenu.saml.modal.helpText'
                                defaultMessage="The attribute in the SAML server used to sync as a custom attribute in user's profile in Mattermost."
                            />
                        }
                        modalHeaderText={
                            <FormattedMessage
                                id='admin.system_properties.user_properties.dotmenu.saml.modal.title'
                                defaultMessage='Link attribute to SAML'
                            />
                        }
                    />
                )}
            </>
        );
    }

    if (field.type !== 'multiselect' && field.type !== 'select') {
        return (
            <span className='user-property-field-values'>
                {'-'}
            </span>
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
                isDisabled={field.delete_at !== 0}
                onChange={(newValues) => {
                    setFieldOptions(newValues.map(({id, value}) => ({id, name: value})));
                }}
                onInputChange={(newValue) => setQuery(newValue)}
                onKeyDown={handleKeyDown}
                onBlur={handleOnBlur}
                placeholder={formatMessage({id: 'admin.system_properties.user_properties.table.values.placeholder', defaultMessage: 'Add values… (required)'})}
                value={field.attrs.options?.map((option) => ({label: option.name, value: option.name, id: option.id}))}
                menuPortalTarget={document.body}
                styles={styles}
            />
            {!isQueryValid && (
                <FormattedMessage
                    tagName={DangerText}
                    id='admin.system_properties.user_properties.table.validation.values_unique'
                    defaultMessage='Values must be unique.'
                />
            )}
        </>
    );
};

const checkForDuplicates = (options: PropertyFieldOption[] | undefined, newOptionName: string) => {
    return options?.some((option) => option.name === newOptionName);
};

const customComponents: SelectProps['components'] = {
    DropdownIndicator: undefined,
    ClearIndicator: undefined,
    IndicatorsContainer: () => null,
    Input: (props) => {
        return (
            <components.Input
                {...props}
                maxLength={Constants.MAX_CUSTOM_ATTRIBUTE_LENGTH}
            />
        );
    },
};

const styles: SelectProps['styles'] = {
    multiValue: (base) => ({
        ...base,
        borderRadius: '12px',
        paddingLeft: '6px',
        paddingTop: '1px',
        paddingBottom: '1px',
        backgroundColor: 'rgba(var(--center-channel-color-rgb), 0.08)',
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
};

export default UserPropertyValues;

