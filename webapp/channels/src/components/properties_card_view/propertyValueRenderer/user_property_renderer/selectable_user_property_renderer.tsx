// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import type {PropertyField} from '@mattermost/types/properties';

import './seletable_user_property_renderer.scss';
import {UserMultiSelector} from 'components/admin_console/content_flagging/user_multiselector/user_multiselector';

type Props = {
    field: PropertyField;
}

export function SelectableUserPropertyRenderer({field}: Props) {
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
                isMulti={false}
                id={`selectable-user-property-renderer-${field.id}`}
                placeholder={placeholder}
                showDropdownIndicator={true}
            />
        </div>
    );
}
