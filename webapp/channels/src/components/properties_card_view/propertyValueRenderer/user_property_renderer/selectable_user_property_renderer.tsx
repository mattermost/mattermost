// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import {useIntl} from 'react-intl';

import type {PropertyField} from '@mattermost/types/properties';

import './selectable_user_property_renderer.scss';
import {UserSelector} from 'components/admin_console/content_flagging/user_multiselector/user_multiselector';
import type {UserPropertyMetadata} from 'components/properties_card_view/properties_card_view';

type Props = {
    field: PropertyField;
    metadata?: UserPropertyMetadata;
    initialValue?: string;
}

export function SelectableUserPropertyRenderer({field, metadata, initialValue}: Props) {
    const {formatMessage} = useIntl();
    const [value, setValue] = useState('');

    useEffect(() => {
        if (initialValue) {
            setValue(initialValue);
        }
    }, [initialValue]);

    const placeholder = (
        <span className='SelectableUserPropertyRenderer_placeholder'>
            <i className='icon icon-account-outline'/>
            {formatMessage({id: 'generic.unassigned', defaultMessage: 'Unassigned'})}
        </span>
    );

    const onSelect = useCallback((userId: string) => {
        if (metadata?.setUser) {
            metadata.setUser(userId);
            setValue(userId);
        }
    }, [metadata]);

    return (
        <div
            className='SelectableUserPropertyRenderer'
            data-testid='selectable-user-property'
        >
            <UserSelector
                isMulti={false}
                id={`selectable-user-property-renderer-${field.id}`}
                placeholder={placeholder}
                showDropdownIndicator={true}
                searchFunc={metadata?.searchUsers}
                singleSelectOnChange={onSelect}
                singleSelectInitialValue={value}
            />
        </div>
    );
}
