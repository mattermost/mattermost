// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedList, FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import type {UserPropertyField} from '@mattermost/types/properties_user';
import type {UserProfile} from '@mattermost/types/users';

import {getPluginDisplayName} from 'selectors/plugins';

import AssignmentGraphPicker from 'components/property_fields/hierarchical_value_menu/assignment_picker';
import SettingItem from 'components/setting_item';
import SettingItemMax from 'components/setting_item_max';

import {Constants} from 'utils/constants';
import {getUserPropertyFieldLabel} from 'utils/properties';

import type {GlobalState} from 'types/store';

import {asGraphValueIds} from '.';
import {useGraphOptionNames} from './use_graph_option_names';

type PluginDisplayNameProps = {
    pluginId?: string;
};

const PluginDisplayName: React.FC<PluginDisplayNameProps> = ({pluginId}) => {
    const displayName = useSelector((state: GlobalState) => getPluginDisplayName(state, pluginId));
    return <>{displayName}</>;
};

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
    const storedIds = asGraphValueIds(storedValue);
    const {labelForId} = useGraphOptionNames(attribute, storedIds);

    const isProtected = Boolean(attribute.attrs?.protected);
    const isSynced = Boolean((user.auth_service === Constants.LDAP_SERVICE && attribute.attrs?.ldap) ||
        (user.auth_service === Constants.SAML_SERVICE && attribute.attrs?.saml));
    const isAdminManaged = attribute.attrs?.managed === 'admin';
    const isOwnerManaged = Boolean(attribute.attrs?.owners?.length);
    const isReadOnly = isSynced || isOwnerManaged || isAdminManaged || isProtected;

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
        }

        if (!isReadOnly) {
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

    if (storedIds.length > 0) {
        const named = storedIds.map((id) => labelForId(id));
        if (named.every((label) => label.kind === 'name')) {
            describe = <FormattedList value={named.map((label) => label.text)}/>;
        } else {
            describe = (
                <FormattedMessage
                    id='user.settings.general.graphValuesSelected'
                    defaultMessage='{count, plural, one {# value selected} other {# values selected}}'
                    values={{count: storedIds.length}}
                />
            );
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
