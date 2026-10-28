// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';

import type {GlobalAttributeSource} from '@mattermost/types/global_attributes';

import * as Menu from 'components/menu';
import Input from 'components/widgets/inputs/input/input';

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

// An undefined value is "All", which sends no source.
const options: Array<{value: GlobalAttributeSource | undefined; label: MessageDescriptor}> = [
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
    const {formatMessage} = useIntl();
    const selected = options.find((option) => option.value === value) ?? options[0];

    return (
        <div className='GlobalAttributes__filter'>
            <Menu.Container
                menuButton={{
                    id: 'globalAttributesSourceFilterButton',
                    class: 'inputWithMenu',
                    dataTestId: 'global-attributes-source-filter',
                    'aria-label': formatMessage(messages.menuButtonAriaLabel),
                    as: 'div',
                    children: (
                        <Input
                            label={formatMessage(messages.label)}
                            name='globalAttributesSourceFilter'
                            value={formatMessage(selected.label)}
                            readOnly={true}
                            tabIndex={-1}
                            inputSuffix={<i className='icon icon-chevron-down'/>}
                        />
                    ),
                }}
                menu={{
                    id: 'globalAttributesSourceFilterMenu',
                    'aria-label': formatMessage(messages.menuAriaLabel),
                }}
            >
                {options.map((option) => {
                    const checked = option.value === selected.value;
                    const key = option.value ?? 'all';
                    return (
                        <Menu.Item
                            key={key}
                            id={`globalAttributesSourceFilter-${key}`}
                            role='menuitemradio'
                            aria-checked={checked}
                            forceCloseOnSelect={true}
                            labels={<FormattedMessage {...option.label}/>}
                            trailingElements={checked && <i className='icon icon-check'/>}
                            onClick={() => onChange(option.value)}
                        />
                    );
                })}
            </Menu.Container>
        </div>
    );
}
