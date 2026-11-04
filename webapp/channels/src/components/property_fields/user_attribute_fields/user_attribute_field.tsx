// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedList, FormattedMessage, defineMessages, useIntl} from 'react-intl';
import type {MessageDescriptor} from 'react-intl';
import {useSelector} from 'react-redux';
import ReactSelect from 'react-select';

import {SyncIcon, PowerPlugOutlineIcon, CheckIcon, ChevronDownIcon} from '@mattermost/compass-icons/components';
import {valueRefersToOptions, type PropertyFieldOption} from '@mattermost/types/properties';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import {getInputTypeFromValueType} from 'mattermost-redux/utils/helpers';
import {getPropertyFieldSyncSources} from 'mattermost-redux/utils/property_utils';
import type {PropertySyncSource} from 'mattermost-redux/utils/property_utils';

import {getPluginDisplayName} from 'selectors/plugins';

import RankBadge from 'components/admin_console/system_properties/rank_badge';
import * as Menu from 'components/menu';
import {asGraphValueIds} from 'components/property_fields/graph';
import {AssignmentGraphPicker} from 'components/property_fields/hierarchical_value_menu';

import {getUserPropertyFieldLabel} from 'utils/properties';

import type {GlobalState} from 'types/store';

import {canEditUserAttribute, isAdminManagedLocked} from './user_attribute_utils';
import type {UserAttributeValue} from './user_attribute_utils';

import './user_attribute_fields.scss';

// Private component for CPA multiselect fields
type CPAMultiSelectProps = {
    options: Array<{id: string; name: string}>;
    selectedValues: string[];
    onChange: (values: string[]) => void;
    disabled: boolean;
    placeholder: string;
    noOptionsMessage: string;
    errorId?: string;
};

const CPAMultiSelect: React.FC<CPAMultiSelectProps> = ({
    options,
    selectedValues,
    onChange,
    disabled,
    placeholder,
    noOptionsMessage,
    errorId,
}) => {
    // Transform options to ReactSelect format
    const selectOptions = options.map((option) => ({
        value: option.id,
        label: option.name,
    }));

    // Keep assigned ids even when the option is gone; dropping them shrinks the saved value.
    const selectedOptions = selectedValues.map((selectedId) => {
        const option = options.find((opt) => opt.id === selectedId);
        return {value: selectedId, label: option?.name ?? selectedId};
    });

    return (
        <ReactSelect
            isMulti={true}
            options={selectOptions}
            value={selectedOptions}
            onChange={(selectedOptions) => {
                const selectedIds = selectedOptions ? selectedOptions.map((opt) => opt.value) : [];
                onChange(selectedIds);
            }}
            isDisabled={disabled}
            aria-invalid={errorId ? true : undefined}
            aria-errormessage={errorId}
            isClearable={false}

            // A disabled select keeps its values; a remove button on each would
            // suggest otherwise.
            components={disabled ? {MultiValueRemove: () => null} : undefined}
            placeholder={placeholder}
            noOptionsMessage={() => noOptionsMessage}
            styles={{
                container: (provided) => ({
                    ...provided,
                    maxWidth: '320px',
                }),
            }}
        />
    );
};

// Private component for CPA ranked fields. Renders a menu of the field's options
// in descending rank order (highest first), each prefixed with its rank badge and
// a trailing checkmark on the selected value. The set of options is
// already filtered server-side per the viewer's authorization; this component does
// not apply the visibility rule itself.
type CPARankSelectProps = {
    fieldId: string;
    options: PropertyFieldOption[];
    value: string;
    onChange: (optionId: string) => void;
    disabled: boolean;
    placeholder: string;
    errorId?: string;
};

const CPARankSelect: React.FC<CPARankSelectProps> = ({fieldId, options, value, onChange, disabled, placeholder, errorId}) => {
    // Highest rank first. Options missing a rank (shouldn't happen on a ranked
    // field) sort to the bottom.
    const orderedOptions = [...options].sort((a, b) => (b.rank ?? -Infinity) - (a.rank ?? -Infinity));
    const selectedOption = options.find((option) => option.id === value);

    return (
        <Menu.Container
            menuButton={{
                id: `cpa-rank-button-${fieldId}`,
                class: classNames('cpa-rank-select__button', {disabled}),
                children: (
                    <span className='cpa-rank-select__button-inner'>
                        {selectedOption ? (
                            <span className='cpa-rank-select__value'>
                                <RankBadge rank={selectedOption.rank}/>
                                <span>{selectedOption.name}</span>
                            </span>
                        ) : (
                            <span className='cpa-rank-select__placeholder'>{placeholder}</span>
                        )}
                        <ChevronDownIcon
                            size={18}
                            color='rgba(var(--center-channel-color-rgb), 0.5)'
                        />
                    </span>
                ),
                dataTestId: `cpa-rank-select-${fieldId}`,
                disabled,
                'aria-describedby': errorId,
            }}
            menu={{
                id: `cpa-rank-menu-${fieldId}`,
                'aria-label': placeholder,
            }}
        >
            {orderedOptions.map((option) => {
                const isSelected = option.id === value;
                return (
                    <Menu.Item
                        id={`cpa-rank-option-${option.id}`}
                        key={option.id}
                        role='menuitemradio'
                        forceCloseOnSelect={true}
                        aria-checked={isSelected}
                        onClick={() => onChange(option.id)}
                        leadingElement={<RankBadge rank={option.rank}/>}
                        labels={<span>{option.name}</span>}
                        trailingElements={isSelected ? <CheckIcon/> : undefined}
                    />
                );
            })}
        </Menu.Container>
    );
};

// Private component to get plugin display name
type PluginDisplayNameProps = {
    pluginId?: string;
};

const PluginDisplayName: React.FC<PluginDisplayNameProps> = ({pluginId}) => {
    const displayName = useSelector((state: GlobalState) => getPluginDisplayName(state, pluginId));
    return <>{displayName}</>;
};

const syncSourceChipMessages: Record<PropertySyncSource, MessageDescriptor> = defineMessages({
    ldap: {id: 'admin.userManagement.userDetail.ldap', defaultMessage: 'AD/LDAP: {propertyName}'},
    saml: {id: 'admin.userManagement.userDetail.saml', defaultMessage: 'SAML: {propertyName}'},
    openid: {id: 'admin.userManagement.userDetail.openid', defaultMessage: 'OpenID Connect: {propertyName}'},
});

type CpaFieldManagementIndicatorProps = {
    field: UserPropertyField;

    omitLocksField: boolean;
    adminManagedLocked: boolean;
};

const CpaFieldManagementIndicator: React.FC<CpaFieldManagementIndicatorProps> = ({field, omitLocksField, adminManagedLocked}) => {
    const pluginsById = useSelector((state: GlobalState) => state.plugins?.plugins ?? {});
    const owners = field.attrs?.owners ?? [];
    const syncSources = getPropertyFieldSyncSources(field);
    const hasSyncedSources = syncSources.length > 0 || owners.length > 0;
    const isProtected = Boolean(field.attrs?.protected);

    if (hasSyncedSources) {
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
                    className='user-detail-cpa-field__chip'
                    key={key}
                    data-testid={`user-detail-cpa-field__owner-${field.name}-${owner.id}`}
                >
                    {content}
                </span>
            );
        });

        const syncedProperties = [
            ...syncSources.map((source) => (
                <span
                    className='user-detail-cpa-field__chip'
                    key={`${field.name}-${source}`}
                    data-testid={`user-detail-cpa-field__${source}-${field.name}`}
                >
                    <FormattedMessage
                        {...syncSourceChipMessages[source]}
                        values={{propertyName: field.attrs?.[source]}}
                    />
                </span>
            )),
            ...ownerPills,
        ];

        return (
            <div className='user-property-field-values__sync-indicator'>
                <SyncIcon size={18}/>
                <span>
                    <FormattedMessage
                        id='admin.system_properties.user_properties.table.values.synced_with'
                        defaultMessage='Synced with: {syncedProperties}'
                        values={{syncedProperties: <FormattedList value={syncedProperties}/>}}
                    />
                </span>
            </div>
        );
    }

    if (isProtected) {
        return (
            <div className='user-property-field-values__sync-indicator'>
                <PowerPlugOutlineIcon size={18}/>
                <span>
                    <FormattedMessage
                        id='admin.userManagement.userDetail.managedByPlugin'
                        defaultMessage='Managed by plugin: {pluginId}'
                        values={{
                            pluginId: <PluginDisplayName pluginId={field.attrs?.source_plugin_id}/>,
                        }}
                    />
                </span>
            </div>
        );
    }

    if (omitLocksField) {
        return (
            <div className='user-property-field-values__sync-indicator'>
                <FormattedMessage
                    id='admin.userManagement.userDetail.field_options_omitted'
                    defaultMessage='This field has too many options to be edited here.'
                />
            </div>
        );
    }

    if (adminManagedLocked) {
        return (
            <div className='user-property-field-values__sync-indicator'>
                <FormattedMessage
                    id='user.settings.general.field_managed_by_admin'
                    defaultMessage='This field can only be changed by an administrator.'
                />
            </div>
        );
    }

    return null;
};

export type UserAttributeFieldProps = {
    field: UserPropertyField;
    value: UserAttributeValue | undefined;
    error?: string;
    onChange: (fieldId: string, value: UserAttributeValue) => void;
    disabled?: boolean;
    canEditAdminManaged: boolean;
    testIdPrefix?: string;
    trailing?: React.ReactNode;
};

export default function UserAttributeField({
    field,
    value: rawValue,
    error,
    onChange,
    disabled = false,
    canEditAdminManaged,
    testIdPrefix = 'user-detail-custom-attribute',
    trailing,
}: UserAttributeFieldProps) {
    const intl = useIntl();
    const value = rawValue || '';
    const lockOpts = {canEditAdminManaged};
    const omitLocksField = Boolean(field.attrs?.options_omitted) && field.type !== 'graph';
    const isDisabled = disabled || !canEditUserAttribute(field, lockOpts);
    const errorId = field.id + '-error';
    const describedErrorId = error ? errorId : undefined;

    const fieldContent = (() => {
        if (omitLocksField && valueRefersToOptions(field)) {
            const display = Array.isArray(value) ?
                value.join(intl.formatMessage({
                    id: 'admin.userManagement.userDetail.arrayValueSeparator',
                    defaultMessage: ', ',
                })) :
                String(value);
            return (
                <input
                    className='form-control'
                    type='text'
                    value={display}
                    disabled={true}
                    readOnly={true}
                />
            );
        }

        switch (field.type) {
        case 'select': {
            const options = field.attrs?.options || [];
            return (
                <select
                    className='form-control'
                    value={Array.isArray(value) ? value[0] || '' : value}
                    onChange={(e) => onChange(field.id, e.target.value)}
                    disabled={isDisabled}
                    aria-invalid={error ? 'true' : undefined}
                    aria-describedby={describedErrorId}
                >
                    <option value=''>
                        {intl.formatMessage({
                            id: 'admin.userManagement.userDetail.selectOption',
                            defaultMessage: 'Select an option',
                        })}
                    </option>
                    {options.map((option) => (
                        <option
                            key={option.id}
                            value={option.id}
                        >
                            {option.name}
                        </option>
                    ))}
                </select>
            );
        }
        case 'rank': {
            const options = field.attrs?.options || [];
            return (
                <CPARankSelect
                    fieldId={field.id}
                    options={options}
                    value={Array.isArray(value) ? value[0] || '' : value}
                    onChange={(optionId) => onChange(field.id, optionId)}
                    disabled={isDisabled}
                    errorId={describedErrorId}
                    placeholder={intl.formatMessage({
                        id: 'admin.userManagement.userDetail.selectOption',
                        defaultMessage: 'Select an option',
                    })}
                />
            );
        }
        case 'graph': {
            const selectedValues = asGraphValueIds(value);
            return (
                <AssignmentGraphPicker
                    field={field}
                    ids={selectedValues}
                    onIdsChange={(values) => onChange(field.id, values)}
                    disabled={isDisabled}
                    menuId={`cpa-graph-menu-${field.id}`}
                    buttonId={`cpa-graph-button-${field.id}`}
                    buttonDataTestId={`cpa-graph-select-${field.id}`}
                    placeholder={intl.formatMessage({
                        id: 'admin.user.selectOptions',
                        defaultMessage: 'Select options...',
                    })}
                    ariaLabel={getUserPropertyFieldLabel(field)}
                />
            );
        }
        case 'multiselect': {
            const options = field.attrs?.options || [];
            const selectedValues = Array.isArray(value) ? value : [];

            return (
                <CPAMultiSelect
                    options={options}
                    selectedValues={selectedValues}
                    onChange={(values) => onChange(field.id, values)}
                    disabled={isDisabled}
                    errorId={describedErrorId}
                    placeholder={intl.formatMessage({
                        id: 'admin.user.selectOptions',
                        defaultMessage: 'Select options...',
                    })}
                    noOptionsMessage={intl.formatMessage({
                        id: 'admin.userManagement.userDetail.noOptions',
                        defaultMessage: 'No options available',
                    })}
                />
            );
        }
        case 'text':
        default: {
            const inputType = getInputTypeFromValueType(field.attrs?.value_type);

            return (
                <input
                    className={classNames('form-control', {
                        error,
                    })}
                    type={inputType}
                    value={Array.isArray(value) ? value.join(intl.formatMessage({id: 'admin.userManagement.userDetail.arrayValueSeparator', defaultMessage: ', '})) : value}
                    onChange={(e) => onChange(field.id, e.target.value)}
                    disabled={isDisabled}
                    aria-describedby={describedErrorId}
                    aria-invalid={error ? 'true' : 'false'}
                />
            );
        }
        }
    })();

    const fieldName = (
        <FormattedMessage
            id='admin.userManagement.userDetail.cpaField'
            defaultMessage='{fieldName}'
            values={{fieldName: getUserPropertyFieldLabel(field)}}
        />
    );

    const fieldBody = (
        <>
            {field.type === 'graph' ? (
                <label
                    htmlFor={`cpa-graph-button-${field.id}`}
                    onClick={() => {
                        // Graph Menu triggers are <div role="button"> so chip
                        // removes can be real buttons. Divs are not labelable,
                        // so htmlFor alone does not open the menu — click it.
                        document.getElementById(`cpa-graph-button-${field.id}`)?.click();
                    }}
                >
                    {fieldName}
                </label>
            ) : fieldName}
            {fieldContent}
            {error && (
                <div
                    id={errorId}
                    className='field-error'
                    data-testid='fieldError'
                    role='alert'
                    aria-live='polite'
                >
                    {error}
                </div>
            )}
            <CpaFieldManagementIndicator
                field={field}
                omitLocksField={omitLocksField}
                adminManagedLocked={isAdminManagedLocked(field, lockOpts)}
            />
        </>
    );

    const testId = `${testIdPrefix}-label-${field.id}`;

    // A graph picker is a div trigger with chip-remove buttons inside it.
    // Wrapping that in <label> forwards chip clicks to the trigger, so the X
    // opens the menu instead of removing the value. Point the name at the
    // trigger instead (with a click forwarder — divs are not labelable).
    const root = field.type === 'graph' ? (
        <div
            className='UserAttributeField cpa-field'
            data-testid={testId}
        >
            {fieldBody}
        </div>
    ) : (
        <label
            className='UserAttributeField cpa-field'
            data-testid={testId}
        >
            {fieldBody}
        </label>
    );

    if (!trailing) {
        return root;
    }

    return (
        <div className='UserAttributeField__row'>
            {root}
            <div className='UserAttributeField__trailing'>{trailing}</div>
        </div>
    );
}
