// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import type {
    PropertyField,
    PropertyValue,
} from '@mattermost/types/properties';

import {UserMultiSelector} from 'components/admin_console/content_flagging/user_multiselector/user_multiselector';

import './seletable_user_property_renderer.scss';

type Props = {
    field: PropertyField;
    value: PropertyValue<unknown>;
}

export function SelectableUserPropertyRenderer({field, value}: Props) {
    const {formatMessage} = useIntl();
    const placeholder = (
        <span className='SelectableUserPropertyRenderer_placeholder'>
            <i className='icon icon-account-outline'/>
            {formatMessage({id: 'generic.unassigned', defaultMessage: 'Unassigned'})}
        </span>
    );

    return (
        <div className='SelectableUserPropertyRenderer'>
            <UserMultiSelector
                id={`selectable-user-property-renderer-${field.id}`}
                onChange={() => {}}
                placeholder={placeholder}
                showDropdownIndicator={true}
            />
        </div>
    );
}
