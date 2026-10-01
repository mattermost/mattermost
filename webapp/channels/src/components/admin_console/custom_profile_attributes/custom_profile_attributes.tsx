// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// This component implements the "User Attributes" admin UI, formerly known as
// "Custom Profile Attributes" (CPA). Internal identifiers retain the old
// naming for backward compatibility. See MM-68235.

import React, {useEffect, useState, type JSX} from 'react';
import './custom_profile_attributes.scss';
import {FormattedList, FormattedMessage, defineMessage} from 'react-intl';
import {useSelector} from 'react-redux';
import {Link} from 'react-router-dom';

import {supportsExternalSync} from '@mattermost/types/properties';
import type {UserPropertyField, UserPropertyFieldType} from '@mattermost/types/properties_user';

import {Client4} from 'mattermost-redux/client';
import {getCustomProfileAttributes} from 'mattermost-redux/selectors/entities/general';

import {getPluginDisplayName} from 'selectors/plugins';

import {conflictingExternalSources, externalSourceLinksFromField, externalSourceMessages} from 'components/admin_console/global_attributes/attribute_details/external_source';
import type {ExternalSource} from 'components/admin_console/global_attributes/attribute_details/external_source';
import {GLOBAL_ATTRIBUTES_GROUP_NAME, GLOBAL_ATTRIBUTES_OBJECT_TYPE} from 'components/admin_console/global_attributes/constants';
import SettingsGroup from 'components/admin_console/settings_group';
import TextSetting from 'components/admin_console/text_setting';

import {getUserPropertyFieldLabel} from 'utils/properties';

import type {GlobalState} from 'types/store';

type AttributeHelpTextProps = {
    attributeKey: ExternalSource;
    attributeName: string;
    attributeType: string;
};

type PluginManagedFieldHelpTextProps = {
    pluginId?: string;
};

const PluginManagedFieldHelpText = ({pluginId}: PluginManagedFieldHelpTextProps) => {
    const pluginDisplayName = useSelector((state: GlobalState) => getPluginDisplayName(state, pluginId));
    return (
        <FormattedMessage
            id='admin.customProfileAttributes.managedByPlugin'
            defaultMessage='This field is managed by the {pluginId} plugin and cannot be edited.'
            values={{pluginId: pluginDisplayName}}
        />
    );
};

const AttributeHelpText = ({attributeKey, attributeName, attributeType}: AttributeHelpTextProps) => (
    <div className='help-text-container'>
        {attributeKey === 'ldap' && (
            <FormattedMessage
                id='admin.customProfileAttribDesc.ldap'
                defaultMessage='(Optional) The attribute in the AD/LDAP server used to populate the {name} of users in Mattermost. When set, users cannot edit their {name}, since it is synchronized with the LDAP server. When left blank, users can set their {name} in <strong>Account Menu > Account Settings > Profile</strong>.'
                values={{
                    name: attributeName,
                    strong: (msg) => <strong>{msg}</strong>,
                }}
            />
        )}
        {attributeKey === 'saml' && (
            <FormattedMessage
                id='admin.customProfileAttribDesc.saml'
                defaultMessage='(Optional) The attribute in the SAML Assertion that will be used to populate the {name} of users in Mattermost.'
                values={{
                    name: attributeName,
                }}
            />
        )}
        {attributeKey === 'openid' && (
            <FormattedMessage
                id='admin.customProfileAttribDesc.openid'
                defaultMessage='(Optional) The claim in the ID token or userinfo response used to populate the {name} of users in Mattermost. Use dots for nested claims, such as address.country. If the claim is missing at sign-in, the value is removed.'
                values={{
                    name: attributeName,
                }}
            />
        )}
        {!supportsExternalSync({type: attributeType as UserPropertyFieldType}) && (
            <div className='help-text-warning'>
                <FormattedMessage
                    id='admin.customProfileAttribWarning'
                    defaultMessage='(Warning) This attribute will be converted to a TEXT attribute, if the field is set to synchronize.'
                />
            </div>
        )}
    </div>
);

AttributeHelpText.displayName = 'AttributeHelpText';

type Props = {
    disabled?: boolean;
    setSaveNeeded: () => void;
    registerSaveAction: (saveAction: () => Promise<unknown>) => void;
    unRegisterSaveAction: (saveAction: () => Promise<unknown>) => void;
    id?: string;
};

type SaveActionResult = {
    error?: Error;
};

// The sync source each settings page links attributes to, by the id of the
// setting that mounts this component there.
const SOURCE_BY_SETTING_ID: Record<string, ExternalSource> = {
    'LdapSettings.CustomProfileAttributes': 'ldap',
    'SamlSettings.CustomProfileAttributes': 'saml',
    'OpenIdSettings.CustomProfileAttributes': 'openid',
};

const getAttributeKey = (id?: string): ExternalSource => {
    return (id && SOURCE_BY_SETTING_ID[id]) || 'ldap';
};

const CustomProfileAttributes: React.FC<Props> = (props: Props): JSX.Element | null => {
    const customProfileAttributeFields = useSelector((state: GlobalState) => getCustomProfileAttributes(state));
    const [attributes, setAttributes] = useState<UserPropertyField[]>(
        Object.values(customProfileAttributeFields),
    );
    const [originalAttributes] = useState<UserPropertyField[]>(attributes);
    const attributeKey = getAttributeKey(props.id);

    useEffect(() => {
        const handleSave = async () => {
            try {
                await Promise.all(
                    attributes.map((attr) => {
                        const original = originalAttributes.find((o) => o.id === attr.id);
                        if (original?.attrs?.[attributeKey] !== attr.attrs?.[attributeKey]) {
                            const newValue = (attr.attrs?.[attributeKey] as string) || null;

                            if (attr.linked_field_id) {
                                // Field is linked to a Global Attribute template: patch
                                // the template (canonical schema owner) and the user field
                                // separately via the property-field API.
                                return Promise.all([
                                    Client4.patchPropertyField(GLOBAL_ATTRIBUTES_GROUP_NAME, GLOBAL_ATTRIBUTES_OBJECT_TYPE, attr.linked_field_id, {attrs: {[attributeKey]: newValue}}),
                                    Client4.patchPropertyField(GLOBAL_ATTRIBUTES_GROUP_NAME, 'user', attr.id, {attrs: {[attributeKey]: newValue}}),
                                ]);
                            }

                            // A type the source can populate keeps its type, and
                            // only the link is patched: a select or multiselect's
                            // options belong to the sync once it is linked, so
                            // sending back the list loaded with this page could
                            // undo options the sync has added since.
                            if (supportsExternalSync(attr)) {
                                return Client4.patchPropertyField(GLOBAL_ATTRIBUTES_GROUP_NAME, 'user', attr.id, {attrs: {[attributeKey]: newValue}});
                            }

                            return Client4.patchCustomProfileAttributeField(attr.id, {
                                type: 'text' as UserPropertyFieldType,
                                attrs: {...attr.attrs},
                            });
                        }
                        return Promise.resolve(null);
                    }),
                );

                return {error: undefined} as SaveActionResult;
            } catch (error) {
                return {error} as SaveActionResult;
            }
        };

        props.registerSaveAction(handleSave);
        return () => props.unRegisterSaveAction(handleSave);
    }, [props.registerSaveAction, props.unRegisterSaveAction, attributes, originalAttributes, attributeKey]);

    if (attributes.length === 0) {
        return null;
    }

    return (
        <div className='custom-profile-attributes'>
            <SettingsGroup
                id={props.id}
                title={defineMessage({
                    id: 'admin.customProfileAttributes.title',
                    defaultMessage: 'User attributes sync',
                })}
                container={false}
                subtitle={
                    <FormattedMessage
                        id='admin.customProfileAttributes.subtitle'
                        defaultMessage='You can add or remove user attributes on the <link>Attribute Management</link> page.'
                        values={{
                            link: (msg) => (
                                <Link
                                    to='/admin_console/system_attributes/manage_attributes'
                                >
                                    {msg}
                                </Link>
                            ),
                        }}
                    />
                }
            >
                <div className={'custom-section-body'}>
                    {attributes.map((attr) => {
                        const isProtected = Boolean(attr.attrs?.protected);
                        const sourcePluginId = attr.attrs?.source_plugin_id;

                        // A linked field's type belongs to its Global Attribute,
                        // so it cannot be converted to text here the way an
                        // unlinked field is.
                        const isLinkedUnsyncable = Boolean(attr.linked_field_id) && !supportsExternalSync(attr);

                        // OpenID Connect and the other sources exclude each other,
                        // judged on the links as saved: a link typed on this page
                        // is not saved until the page is.
                        const original = originalAttributes.find((o) => o.id === attr.id) ?? attr;
                        const conflicts = conflictingExternalSources(attributeKey, externalSourceLinksFromField(original));
                        let helpText;
                        if (isLinkedUnsyncable) {
                            helpText = (
                                <FormattedMessage
                                    id='admin.customProfileAttributes.linkedNonText'
                                    defaultMessage='This field is a management attribute of type {type} and cannot be synced from an identity source. Only text, select and multiselect attributes support sync.'
                                    values={{type: attr.type}}
                                />
                            );
                        } else if (conflicts.length > 0) {
                            helpText = (
                                <FormattedMessage
                                    id='admin.customProfileAttributes.exclusiveSource'
                                    defaultMessage="This attribute is synced from {sources}. An attribute synced from OpenID Connect can't also sync from AD/LDAP or SAML."
                                    values={{
                                        sources: (
                                            <FormattedList
                                                type='conjunction'
                                                value={conflicts.map((source) => (
                                                    <FormattedMessage
                                                        key={source}
                                                        {...externalSourceMessages[source].title}
                                                    />
                                                ))}
                                            />
                                        ),
                                    }}
                                />
                            );
                        } else if (isProtected) {
                            helpText = <PluginManagedFieldHelpText pluginId={sourcePluginId}/>;
                        } else {
                            helpText = (
                                <AttributeHelpText
                                    attributeKey={attributeKey}
                                    attributeName={getUserPropertyFieldLabel(attr)}
                                    attributeType={attr.type}
                                />
                            );
                        }
                        return (
                            <TextSetting
                                key={attr.id}
                                id={`custom_profile_attribute-${attr.name}`}
                                label={getUserPropertyFieldLabel(attr)}
                                value={attr.attrs?.[attributeKey] as string || ''}
                                onChange={(id, newValue) => {
                                    setAttributes((prevAttrs) => prevAttrs.map((a) => {
                                        if (a.id === attr.id) {
                                            return {
                                                ...a,
                                                attrs: {
                                                    ...a.attrs,
                                                    [attributeKey]: newValue,
                                                },
                                            };
                                        }
                                        return a;
                                    }));
                                    props.setSaveNeeded();
                                }}
                                setByEnv={false}
                                disabled={props.disabled || isProtected || isLinkedUnsyncable || conflicts.length > 0}
                                placeholder={{id: 'admin.customProfileAttr.placeholder', defaultMessage: 'E.g.: "fieldName"'}}
                                helpText={helpText}
                            />
                        );
                    })}
                </div>
            </SettingsGroup>
        </div>
    );
};

export default CustomProfileAttributes;
