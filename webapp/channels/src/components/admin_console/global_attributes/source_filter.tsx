// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessages} from 'react-intl';

import type {GlobalAttributeSource} from '@mattermost/types/global_attributes';

import FilterMenu from './filter_menu';
import type {FilterMenuOption} from './filter_menu';

const messages = defineMessages({
    label: {id: 'admin.global_attributes.filter.source', defaultMessage: 'Source'},
    menuButtonAriaLabel: {id: 'admin.global_attributes.filter.source.menuButtonAriaLabel', defaultMessage: 'Filter attributes by source'},
    menuAriaLabel: {id: 'admin.global_attributes.filter.source.menuAriaLabel', defaultMessage: 'Source menu'},
    all: {id: 'admin.global_attributes.filter.source.all', defaultMessage: 'All'},
    managed: {id: 'admin.global_attributes.filter.source.managed', defaultMessage: 'Managed here'},
    ldap: {id: 'admin.global_attributes.filter.source.ldap', defaultMessage: 'AD/LDAP'},
    saml: {id: 'admin.global_attributes.filter.source.saml', defaultMessage: 'SAML'},
    openid: {id: 'admin.global_attributes.filter.source.openid', defaultMessage: 'OpenID Connect'},
    plugin: {id: 'admin.global_attributes.filter.source.plugin', defaultMessage: 'Plugin'},
});

const options: Array<FilterMenuOption<GlobalAttributeSource>> = [
    {value: undefined, label: messages.all},
    {value: 'managed', label: messages.managed},
    {value: 'ldap', label: messages.ldap},
    {value: 'saml', label: messages.saml},
    {value: 'openid', label: messages.openid},
    {value: 'plugin', label: messages.plugin},
];

type Props = {
    value: GlobalAttributeSource | undefined;
    onChange: (value: GlobalAttributeSource | undefined) => void;
};

export default function SourceFilter({value, onChange}: Props) {
    return (
        <FilterMenu
            id='globalAttributesSourceFilter'
            testId='global-attributes-source-filter'
            label={messages.label}
            menuButtonAriaLabel={messages.menuButtonAriaLabel}
            menuAriaLabel={messages.menuAriaLabel}
            options={options}
            value={value}
            onChange={onChange}
        />
    );
}
