// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState, memo} from 'react';
import './custom_profile_attributes.scss';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';
import {Link} from 'react-router-dom';

import type {UserPropertyField, UserPropertyFieldType} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';
import {getCustomProfileAttributes} from 'mattermost-redux/selectors/entities/general';

import SettingsGroup from 'components/admin_console/settings_group';
import TextSetting from 'components/admin_console/text_setting';

import type {GlobalState} from 'types/store';

type AttributeHelpTextProps = {
    attributeKey: string;
    attributeName: string;
    attributeType: string;
};

const AttributeHelpText = memo(({attributeKey, attributeName, attributeType}: AttributeHelpTextProps) => (
    <div className='help-text-container'>
        {attributeKey === 'ldap' && (
            <FormattedMessage
                id='admin.customProfileAttribDesc'
                defaultMessage='(Optional) The attribute in the AD/LDAP server used to populate the {name} of users in Mattermost. When set, users cannot edit their {name}, since it is synchronized with the LDAP server. When left blank, users can set their {name} in <strong>Account Menu > Account Settings > Profile</strong>.'
                values={{
                    name: attributeName,
                    strong: (msg: string) => <strong>{msg}</strong>,
                }}
            />
        )}
        {attributeKey === 'saml' && (
            <FormattedMessage
                id='admin.customProfileAttribDesc'
                defaultMessage='(Optional) The attribute in the SAML Assertion that will be used to populate the {name} of users in Mattermost.'
                values={{
                    name: attributeName,
                }}
            />
        )}
        {attributeType !== 'text' && (
            <div className='help-text-warning'>
                <FormattedMessage
                    id='admin.customProfileAttribWarning'
                    defaultMessage='(Warning) This attribute will be converted to a TEXT attribute, if the field is set to synchronize.'
                    values={{
                        name: attributeName,
                        strong: (msg: string) => <strong>{msg}</strong>,
                    }}
                />
            </div>
        )}
    </div>
));

AttributeHelpText.displayName = 'AttributeHelpText';

type Props = {
    isDisabled?: boolean;
    setSaveNeeded: () => void;
    registerSaveAction: (saveAction: () => Promise<unknown>) => void;
    unRegisterSaveAction: (saveAction: () => Promise<unknown>) => void;
    id?: string;
}

type SaveActionResult = {
    error?: Error;
};

const getAttributeKey = (id?: string) => {
    return id === 'SamlSettings.CustomProfileAttributes' ? 'saml' : 'ldap';
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
                            const updatedAttr = {
                                type: 'text' as UserPropertyFieldType,
                                attrs: {
                                    ...attr.attrs,
                                },
                            };
                            return Client4.patchCustomProfileAttributeField(attr.id, updatedAttr);
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
    }, [props.registerSaveAction, props.unRegisterSaveAction, attributes, originalAttributes, attributeKey, props]);

    if (attributes.length === 0) {
        return null;
    }

    return (
        <div className='custom-profile-attributes'>
            <SettingsGroup
                id={props.id}
                title={
                    <FormattedMessage
                        id='admin.customProfileAttributes.title'
                        defaultMessage='Custom profile attributes sync'
                    />
                }
                container={false}
                subtitle={
                    <FormattedMessage
                        id='admin.customProfileAttributes.subtitle'
                        defaultMessage='You can add or remove custom profile attributes by going to the <link>system properties page</link>.'
                        values={{
                            link: (msg: string) => (
                                <Link
                                    to='/admin_console/site_config/system_properties'
                                >
                                    {msg}
                                </Link>
                            ),
                        }}
                    />
                }
            >
                {attributes.map((attr) => (
                    <TextSetting
                        key={attr.id}
                        id={`custom_profile_attribute-${attr.name}`}
                        label={attr.name}
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
                        disabled={props.isDisabled}
                        placeholder={{id: 'admin.customProfileAttr.placeholder', defaultMessage: 'E.g.: "fieldName"'}}
                        helpText={
                            <AttributeHelpText
                                attributeKey={attributeKey}
                                attributeName={attr.name}
                                attributeType={attr.type}
                            />
                        }
                    />
                ))}
            </SettingsGroup>
        </div>
    );
};

export default CustomProfileAttributes;
