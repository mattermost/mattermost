// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {FocusEventHandler, KeyboardEventHandler} from 'react';
import React, {useMemo} from 'react';
import {FormattedList, FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import type {GroupBase} from 'react-select';
import {components} from 'react-select';
import type {CreatableProps} from 'react-select/creatable';
import CreatableSelect from 'react-select/creatable';

import {SyncIcon, PowerPlugOutlineIcon} from '@mattermost/compass-icons/components';
import {supportsOptions, type PropertyFieldOption} from '@mattermost/types/properties';
import {type UserPropertyField} from '@mattermost/types/properties_user';

import {getPluginDisplayName} from 'selectors/plugins';

import Constants from 'utils/constants';
import {isKeyPressed} from 'utils/keyboard';

import type {GlobalState} from 'types/store';

import {DangerText} from './controls';
import {useIsFieldOrphaned} from './orphaned_fields_utils';
import './user_properties_values.scss';
import {useAttributeLinkModal} from './user_properties_dot_menu';
import UserPropertyRankValues from './user_properties_rank_values';
import {isLinkedField} from './user_properties_utils';

type Props = {
    field: UserPropertyField;
    updateField: (field: UserPropertyField) => void;
    autoFocus?: boolean;
};

type Option = {label: string; id: string; value: string};
type SelectProps = CreatableProps<Option, true, GroupBase<Option>>;

const UserPropertyValues = ({
    field,
    updateField,
    autoFocus,
}: Props) => {
    const {formatMessage} = useIntl();
    const pluginDisplayName = useSelector((state: GlobalState) => getPluginDisplayName(state, field.attrs?.source_plugin_id));
    const pluginsById = useSelector((state: GlobalState) => state.plugins?.plugins ?? {});
    const isOrphaned = useIsFieldOrphaned(field);

    const [query, setQuery] = React.useState('');
    const {promptEditLdapLink, promptEditSamlLink} = useAttributeLinkModal(field, updateField);

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

    // LDAP/SAML sync locks values and forces text — badge only, no options editor.
    // Owner-managed (e.g. SCIM) locks *values* to the owner but admins may still
    // edit the field definition (options) when the type supports them.
    const owners = field.attrs?.owners ?? [];
    const hasLdapSaml = Boolean(field.attrs.ldap || field.attrs.saml);
    const hasOwners = owners.length > 0;
    const isProtected = Boolean(field.attrs?.protected);
    const optionsEditable = supportsOptions(field) && !hasLdapSaml && !isProtected;

    // In the options cell the sync source sits above the value chips, so it reads
    // as plain text to avoid looking like another value. When it's the standalone
    // badge (no options below), keep the chip styling.
    const ownersInOptionsCell = hasOwners && optionsEditable;

    let syncedBadge: React.ReactNode = null;
    if (hasLdapSaml || hasOwners) {
        const ownerPills = owners.map((owner, idx) => {
            const provenance = owner.type === 'plugin' ? (pluginsById[owner.id]?.name || owner.id) : owner.id;
            const key = `${field.name}-owner-${owner.type}-${owner.id}-${idx}`;

            let content: React.ReactNode;
            if (owner.scopes?.length) {
                content = (
                    <FormattedMessage
                        id='admin.system_properties.user_properties.table.values.owner.scoped'
                        defaultMessage='{provenance}: {scopes}'
                        values={{provenance, scopes: owner.scopes.join(', ')}}
                    />
                );
            } else {
                content = provenance;
            }

            return (
                <span
                    className={ownersInOptionsCell ? 'user-property-field-values__owner' : 'user-property-field-values__chip'}
                    key={key}
                    data-testid={`user-property-field-values__owner-${field.name}-${owner.id}`}
                >
                    {content}
                </span>
            );
        });

        // Editing an LDAP/SAML link rewrites the field as `text`, which the
        // server refuses on a linked field (its type comes from the template).
        // The dot menu already disables the same action when linked; render the
        // chip as plain text here so this cell doesn't offer it either.
        const editable = !isLinkedField(field);
        const editProps = (onEdit: () => void) => (editable ? {
            onClick: onEdit,
            onKeyDown: (e: React.KeyboardEvent) => {
                if (isKeyPressed(e, Constants.KeyCodes.ENTER) || isKeyPressed(e, Constants.KeyCodes.SPACE)) {
                    onEdit();
                }
            },
            role: 'button',
            tabIndex: 0,
        } : {});

        const syncedProperties = [
            field.attrs.ldap && (
                <a
                    className='user-property-field-values__chip-link'
                    key={`${field.name}-ldap`}
                    data-testid={`user-property-field-values__ldap-${field.name}`}
                    {...editProps(promptEditLdapLink)}
                >
                    <FormattedMessage
                        id='admin.system_properties.user_properties.table.values.synced_with.ldap'
                        defaultMessage='AD/LDAP: {propertyName}'
                        values={{propertyName: field.attrs.ldap}}
                    />
                </a>
            ),
            field.attrs.saml && (
                <a
                    className='user-property-field-values__chip-link'
                    key={`${field.name}-saml`}
                    data-testid={`user-property-field-values__saml-${field.name}`}
                    {...editProps(promptEditSamlLink)}
                >
                    <FormattedMessage
                        id='admin.system_properties.user_properties.table.values.synced_with.saml'
                        defaultMessage='SAML: {propertyName}'
                        values={{propertyName: field.attrs.saml}}
                    />
                </a>
            ),
            ...ownerPills,
        ].filter(Boolean);

        syncedBadge = (
            <span className='user-property-field-values__sync'>
                <SyncIcon size={18}/>
                <FormattedMessage
                    id='admin.system_properties.user_properties.table.values.synced_with'
                    defaultMessage='Synced with: {syncedProperties}'
                    values={{syncedProperties: <FormattedList value={syncedProperties}/>}}
                />
            </span>
        );
    }

    // LDAP/SAML always badge-only. Owner-managed text (and other non-option
    // types) also stay badge-only — there are no options to edit.
    if (hasLdapSaml || (hasOwners && !optionsEditable)) {
        return (
            <span className='user-property-field-values'>
                {syncedBadge}
            </span>
        );
    }

    if (isProtected) {
        return (
            <>
                <span className='user-property-field-values'>
                    <PowerPlugOutlineIcon size={18}/>
                    {isOrphaned ? (
                        <FormattedMessage
                            id='admin.system_properties.user_properties.table.values.plugin_removed'
                            defaultMessage='Plugin removed: {pluginId}'
                            values={{pluginId: pluginDisplayName}}
                        />
                    ) : (
                        <FormattedMessage
                            id='admin.system_properties.user_properties.table.values.managed_by_plugin'
                            defaultMessage='Managed by plugin: {pluginId}'
                            values={{pluginId: pluginDisplayName}}
                        />
                    )}
                </span>
            </>
        );
    }

    if (!supportsOptions(field)) {
        return (
            <span className='user-property-field-values'>
                {'-'}
            </span>
        );
    }

    // Linked fields inherit their options from the template they link to; the
    // server rejects an options change on them.
    const isDisabled = field.delete_at !== 0 || isProtected || isLinkedField(field);

    // Ranked fields render numbered chips with a per-chip rank/label/remove
    // popover instead of the plain creatable value list.
    const optionsEditor = field.type === 'rank' ? (
        <UserPropertyRankValues
            field={field}
            updateField={updateField}
            autoFocus={autoFocus}
        />
    ) : (
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
                placeholder={formatMessage({id: 'admin.system_properties.user_properties.table.values.placeholder', defaultMessage: 'Add values… (required)'})}
                value={field.attrs.options?.map((option) => ({label: option.name, value: option.name, id: option.id}))}
                menuPortalTarget={document.body}
                styles={styles}
                autoFocus={autoFocus}
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

    // Owner-managed select/multiselect/rank: show provenance and keep options editable.
    if (syncedBadge) {
        return (
            <div className='user-property-field-values user-property-field-values--with-owners'>
                {syncedBadge}
                <div className='user-property-field-values__options'>
                    {optionsEditor}
                </div>
            </div>
        );
    }

    return optionsEditor;
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

