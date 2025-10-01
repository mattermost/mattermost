// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {
    PropertyField,
    PropertyValue,
} from '@mattermost/types/properties';

import {useUser} from 'components/common/hooks/useUser';
import PreviewPostAvatar from 'components/post_view/post_message_preview/avatar/avatar';
import UserProfileComponent from 'components/user_profile';

import {SelectableUserPropertyRenderer} from './selectable_user_property_renderer';

import './user_property_renderer.scss';

type Props = {
    field: PropertyField;
    value: PropertyValue<unknown>;
}

export default function UserPropertyRenderer({field, value}: Props) {
    const userId = value.value as string;
    const user = useUser(userId);

    if (field.attrs?.editable) {
        return (
            <SelectableUserPropertyRenderer
                field={field}
            />
        );
    }

    return (
        <div
            className='UserPropertyRenderer'
            data-testid='user-property'
        >
            {
                user &&
                <PreviewPostAvatar
                    user={user}
                />
            }
            <UserProfileComponent
                userId={user?.id || ''}
            />
        </div>
    );
}
