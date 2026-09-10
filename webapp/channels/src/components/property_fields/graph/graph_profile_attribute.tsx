// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, FormattedList, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import type {OnChangeValue, StylesConfig} from 'react-select';
import ReactSelect from 'react-select';

import {valueRefersToOptions, type PropertyFieldOption} from '@mattermost/types/properties';
import type {UserPropertyField} from '@mattermost/types/properties_user';
import type {UserProfile} from '@mattermost/types/users';

import useGetFeatureFlagValue from 'components/common/hooks/useGetFeatureFlagValue';
import AssignmentGraphPicker from 'components/property_fields/hierarchical_value_menu/assignment_picker';
import SettingItem from 'components/setting_item';
import SettingItemMax from 'components/setting_item_max';

import {getPluginDisplayName} from 'selectors/plugins';
import {Constants} from 'utils/constants';
import {getUserPropertyFieldLabel} from 'utils/properties';

import type {GlobalState} from 'types/store';

import GraphValueSummary from './graph_value_summary';

type SelectOption = {
    value: string;
    label: string;
};

const selectStyles: StylesConfig<SelectOption, true> = {
    valueContainer: (baseStyles) => ({
        ...baseStyles,
        height: 'auto',
        minHeight: '38px',
        flexWrap: 'wrap',
        whiteSpace: 'normal',
    }),
    multiValue: (baseStyles) => ({
        ...baseStyles,
        margin: '2px',
    }),
    control: (baseStyles) => ({
        ...baseStyles,
        height: 'auto',
        minHeight: '38px',
    }),
    multiValueLabel: (baseStyles) => ({
        ...baseStyles,
        padding: '2px 6px',
    }),
};

type PluginDisplayNameProps = {
    pluginId?: string;
};

const PluginDisplayName: React.FC<PluginDisplayNameProps> = ({pluginId}) => {
    const displayName = useSelector((state: GlobalState) => getPluginDisplayName(state, pluginId));
    return <>{displayName}</>;
};

function getDisplayValue(attribute: UserPropertyField, attributeValue: string | string[]) {
    if (!attributeValue || (!Array.isArray(attributeValue) && !attributeValue.length)) {
        return '';
    }

    if (valueRefersToOptions(attribute)) {
        const attribOptions = attribute.attrs.options;
        const optionsOmitted = Boolean(attribute.attrs?.options_omitted);
        if (!attribOptions) {
            if (optionsOmitted) {
                if (Array.isArray(attributeValue)) {
                    return attributeValue.map((value) => ({label: value, value}));
                }
                return {label: attributeValue, value: attributeValue};
            }
            return '';
        }
        if (Array.isArray(attributeValue)) {
            return attributeValue.map((value) => {
                const option = attribOptions.find((o) => o.id === value);

                return {label: option?.name ?? value, value};
            });
        }

        const option = attribOptions.find((o) => o.id === attributeValue);
        if (option) {
            return {label: option?.name, value: option?.id};
        }
        if (optionsOmitted) {
            return {label: attributeValue, value: attributeValue};
        }
        return '';
    }

    return attributeValue as string;
}

export type GraphProfileAttributeProps = {
    attribute: UserPropertyField;
    sectionName: string;
    active: boolean;
    areAllSectionsInactive: boolean;
    storedValue: string | string[] | undefined;
    draftIds: string[];
    onDraftIdsChange: (ids: string[]) => void;
    onSubmit: () => void;
    updateSection: (section: string) => void;
    sectionIsSaving: boolean;
    serverError?: string;
    isMobileView: boolean;
    user: UserProfile;
};

export default function GraphProfileAttribute({
    attribute,
    sectionName,
    active,
    areAllSectionsInactive,
    storedValue,
    draftIds,
    onDraftIdsChange,
    onSubmit,
    updateSection,
    sectionIsSaving,
    serverError,
    isMobileView,
    user,
}: GraphProfileAttributeProps): JSX.Element {
    const {formatMessage} = useIntl();
    const flagOn = useGetFeatureFlagValue('PropertyFieldGraph') === 'true';
    const optionsOmitted = Boolean(attribute.attrs?.options_omitted);
    const omitLocksField = optionsOmitted && !flagOn;

    const isProtected = Boolean(attribute.attrs?.protected);
    const isSynced = Boolean((user.auth_service === Constants.LDAP_SERVICE && attribute.attrs?.ldap) ||
        (user.auth_service === Constants.SAML_SERVICE && attribute.attrs?.saml));
    const isAdminManaged = attribute.attrs?.managed === 'admin';
    const isOwnerManaged = Boolean(attribute.attrs?.owners?.length);
    const isReadOnly = isSynced || isOwnerManaged || isAdminManaged || isProtected || omitLocksField;

    let max = null;

    if (active) {
        const inputs = [];
        let extraInfo: JSX.Element | string = '';
        let submit = null;

        if (isSynced) {
            extraInfo = (
                <span>
                    <FormattedMessage
                        id='user.settings.general.field_handled_externally'
                        defaultMessage='This field is handled through your login provider. If you want to change it, you need to do so through your login provider.'
                    />
                </span>
            );
        } else if (isOwnerManaged) {
            extraInfo = (
                <span>
                    <FormattedMessage
                        id='user.settings.general.field_managed_externally'
                        defaultMessage='This field is managed by an external integration and cannot be edited here.'
                    />
                </span>
            );
        } else if (isProtected) {
            extraInfo = (
                <span>
                    <FormattedMessage
                        id='user.settings.general.field_managed_by_plugin'
                        defaultMessage='This field is managed by a plugin and cannot be edited.'
                    />
                    {' ('}<PluginDisplayName pluginId={attribute.attrs?.source_plugin_id}/>{')'}
                </span>
            );
        } else if (isAdminManaged) {
            extraInfo = (
                <span>
                    <FormattedMessage
                        id='user.settings.general.field_managed_by_admin'
                        defaultMessage='This field can only be changed by an administrator.'
                    />
                </span>
            );
        } else if (omitLocksField) {
            extraInfo = (
                <span>
                    <FormattedMessage
                        id='user.settings.general.field_options_omitted'
                        defaultMessage='This field has too many options to be edited here.'
                    />
                </span>
            );
        }

        if (!isReadOnly) {
            const attribOptions: PropertyFieldOption[] = (attribute.attrs!.options as PropertyFieldOption[]) ?? [];
            const opts = attribOptions.map((o) => {
                return {label: o.name, value: o.id} as SelectOption;
            });

            const legacySelect = (
                <ReactSelect
                    isMulti={true}
                    key={sectionName}
                    id={'customProfileAttribute_' + attribute.id}
                    inputId={'customProfileAttribute_' + attribute.id + '_input'}
                    className='react-select inlineSelect'
                    classNamePrefix='react-select'
                    options={opts}
                    isClearable={true}
                    isSearchable={false}
                    placeholder={formatMessage({
                        id: 'user.settings.general.select',
                        defaultMessage: 'Select',
                    })}
                    components={{IndicatorSeparator: null}}
                    styles={selectStyles}
                    value={getDisplayValue(attribute, draftIds) as SelectOption}
                    onChange={(v: OnChangeValue<SelectOption, boolean>) => {
                        if (!v) {
                            onDraftIdsChange([]);
                            return;
                        }
                        if (Array.isArray(v)) {
                            onDraftIdsChange(v.
                                filter((option): option is SelectOption =>
                                    Boolean(option && Object.hasOwn(option, 'value'))).
                                map((option) => option.value));
                            return;
                        }
                        if ('value' in v) {
                            onDraftIdsChange(v.value ? [v.value] : []);
                            return;
                        }
                        onDraftIdsChange([]);
                    }}
                />
            );

            inputs.push(
                <AssignmentGraphPicker
                    key={sectionName}
                    field={attribute}
                    ids={draftIds}
                    onIdsChange={onDraftIdsChange}
                    menuId={`customProfileAttributeGraph_${attribute.id}`}
                    buttonId={`customProfileAttributeGraphButton_${attribute.id}`}
                    buttonDataTestId={`customProfileAttributeGraph_${attribute.id}`}
                    placeholder={formatMessage({
                        id: 'user.settings.general.select',
                        defaultMessage: 'Select',
                    })}
                    ariaLabel={getUserPropertyFieldLabel(attribute)}
                    fallback={() => legacySelect}
                />,
            );

            extraInfo = (
                <span>
                    <FormattedMessage
                        id='user.settings.general.attributeExtra'
                        defaultMessage='This will be shown in your profile popover.'
                    />
                </span>
            );
            submit = onSubmit;
        }

        max = (
            <SettingItemMax
                key={'settingItemMax_' + attribute.id}
                title={getUserPropertyFieldLabel(attribute)}
                inputs={inputs}
                submit={submit}
                saving={sectionIsSaving}
                serverError={serverError}
                updateSection={updateSection}
                extraInfo={extraInfo}
                isValid={true}
            />
        );
    }

    let describe: JSX.Element | string = '';

    if (flagOn && Array.isArray(storedValue) && storedValue.length > 0) {
        describe = (
            <GraphValueSummary
                field={attribute}
                ids={storedValue}
                mode='describe'
            />
        );
    } else if (storedValue) {
        const attributeValue = getDisplayValue(attribute, storedValue);
        if (attributeValue) {
            if (typeof attributeValue === 'string') {
                describe = attributeValue;
            } else if (Array.isArray(attributeValue) && attributeValue.length > 0) {
                describe = <FormattedList value={attributeValue.map((attrib) => attrib?.label || null)}/>;
            } else if (!Array.isArray(attributeValue) && Object.hasOwn(attributeValue, 'label')) {
                describe = attributeValue.label || '';
            }
        }
    }

    if (!describe) {
        describe = (
            <FormattedMessage
                id='user.settings.general.emptyAttribute'
                defaultMessage="Click 'Edit' to add your custom attribute"
            />
        );
        if (isMobileView) {
            describe = (
                <FormattedMessage
                    id='user.settings.general.mobile.emptyAttribute'
                    defaultMessage='Click to add your custom attribute'
                />
            );
        }
    }

    return (
        <div key={sectionName}>
            <SettingItem
                key={'settingItem_' + attribute.id}
                active={active}
                areAllSectionsInactive={areAllSectionsInactive}
                title={getUserPropertyFieldLabel(attribute)}
                describe={describe}
                section={sectionName}
                updateSection={updateSection}
                max={max}
            />
            <div className='divider-dark'/>
        </div>
    );
}
